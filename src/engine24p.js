/* ===================== Rules engine — round 24 helper P: replacement / prevention effects and combat requirements ===================== */
const P24 = {};
// static rules are matched on lowercase text: recover the card's original wording (token subtypes need their capitals)
function p24Orig(srcName, frag){ try { const c = boardsAll().flatMap(b => b.bf).find(b => b.k && info(b.k)?.n === srcName); const o = c ? tname(info(c.k)?.o || '', srcName) : ''; const art = (String(frag).match(/^(an? )/i) || ['', ''])[1]; const f2 = String(frag).slice(art.length); const i = o.toLowerCase().indexOf(f2.toLowerCase()); return i >= 0 ? art + o.slice(i, i + f2.length) : frag; } catch { return frag; } }
const p24T = () => turnStr();
const p24Txt = c => c && c.k ? tname(info(c.k)?.o || '', info(c.k)?.n || '').toLowerCase() : '';
function p24Mine(re){ return S ? S.bf.filter(c => c.k && !c.fd && re.test(p24Txt(c))) : []; }
function p24Host(c){ return c && c.att ? {t:'card', pid:c.att.pid || MYPID, id:c.att.id} : null; }
function p24HostCard(h){ return h ? boardOf(h.pid).find(b => b.id === h.id) : null; }
function p24LethalLeft(c, pid, dt){ if (!c) return 0; if (isPW(c)) return Math.max(0, c.co || 0); const st = stats(c, pid); if (!st) return 0; if (dt) return (c.dmg || 0) > 0 ? 0 : 1; return Math.max(0, st[1] - (c.dmg || 0)); }

/* ---------- flags travel with damage across players ---------- */
{
  const cf = cleanFlags;
  cleanFlags = function(f){ const o = cf(f); try { if (f && typeof f === 'object'){ ['p24c', 'p24x', 'p24np'].forEach(k => { if (f[k]) o[k] = 1; }); if (Number.isFinite(f.p24s)) o.p24s = f.p24s; } } catch {} return o; };
  const ao = applyOp;
  applyOp = function(r, from){ const was = UI.p24from; UI.p24from = from; try { return ao(r, from); } finally { UI.p24from = was; } };
}
EV_TYPES.push('p24exc', 'p24prev');

/* ---------- static rules (damage) ---------- */
STATIC_RULES.unshift([/^damage can't be prevented$/, m => ({kind:'p24np', who:'all'})]);
STATIC_RULES.push(
  [/^all damage that would be dealt to you is dealt to (enchanted|equipped) creature instead$/, m => ({kind:'p24redir', who:'you'})],
  [/^all damage that would be dealt to you and other permanents you control is dealt to ~ instead$/, m => ({kind:'p24adam', who:'you'})],
  [/^damage isn't removed from ~ during cleanup steps$/, m => ({kind:'p24keepDmg', who:'you'})],
  [/^combat damage that would be dealt by creatures you control can't be prevented$/, m => ({kind:'p24np', who:'you', cmb:true, cr:true})],
  [/^combat damage can't be prevented$/, m => ({kind:'p24np', who:'all', cmb:true})],
  [/^all damage is dealt as though its source had wither$/, m => ({kind:'p24wither', who:'all'})],
  [/^each creature assigns combat damage equal to its toughness rather than its power$/, m => ({kind:'h23tDmg', who:'all'})],
  [/^if damage would be dealt to another creature you control, prevent that damage$/, m => ({kind:'p24vigor', who:'you'})],
  [/^put a \+1\/\+1 counter on that creature for each 1 damage prevented this way$/, m => ({kind:'noop'})],
  [/^if damage would be dealt to ~, prevent that damage$/, m => ({kind:'p24selfPrev', who:'you'})],
  [/^when damage is prevented this way, ~ deals that much damage to any other target$/, m => ({kind:'noop'})],
  [/^if damage would be dealt to ~, prevent that damage and put that many \+1\/\+1 counters on (?:him|her|them|it)$/, m => ({kind:'p24selfCtr', who:'you'})],
  [/^if damage would be dealt to ~, prevent that damage and an opponent of your choice gains control of it$/, m => ({kind:'p24kharn', who:'you'})],
  [/^if a creature you control that entered this turn would deal damage, it deals twice that much damage instead$/, m => ({kind:'p24neriv', who:'you'})],
  [/^double all damage ~ would deal$/, m => ({kind:'p24selfX2', who:'you'})],
  [/^double all damage that sources you control of the chosen type would deal$/, m => ({kind:'p24typeX2', who:'you'})],
  [/^if a red or artifact source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus (\d+) instead$/, m => ({kind:'p24plus', who:'you', n:+m[1], oppOnly:true, redArt:true})],
  [/^if another source you control would deal noncombat damage to a permanent or player, it deals that much damage plus (\d+) to that permanent or player instead$/, m => ({kind:'p24plus', who:'you', n:+m[1], other:true, nonCmb:true})],
  [/^if a source you control would deal damage to an opponent, prevent that damage and each opponent mills that many cards$/, m => ({kind:'p24mind', who:'you'})],
  [/^if a zombie you control would deal combat damage to a player, instead that player mills that many cards$/, m => ({kind:'p24alch', who:'you'})],
);

/* ---------- source side: what my sources deal ---------- */
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra = {}){
    let hide = null, after = null;
    try { if (S && n > 0 && t){
      extra = {...(extra || {})};
      const T = p24T(); const cmb = !!(UI.r23cmb || UI.h23combat); const mineSrc = srcCard && S.bf.includes(srcCard);
      const opp = !!(t.pid && t.pid !== MYPID); const toPlayer = t.t === 'player';
      if (cmb) extra.p24c = 1;
      if (mineSrc && srcCard.id != null) extra.p24s = srcCard.id;
      if (UI.p24exDie) extra.p24x = 1;
      const cr = srcCard && isCreatureCard(srcCard);
      if (S.p24np === T || rulesOn('p24np').some(r => (!r.cmb || cmb) && (!r.cr || (cr && r.pid === MYPID)))) extra.p24np = 1;
      // damage modifiers of my own permanents
      if (mineSrc && cr && srcCard.p24et === T && rulesOn('p24neriv').length){ log(`${cname(srcCard)} entered this turn — its damage is doubled (Neriv)`); n *= rulesOn('p24neriv').length * 2; }
      if (mineSrc && /^double all damage ~ would deal\.?$/m.test(p24Txt(srcCard))){ log(`${cname(srcCard)}: damage doubled (${n} → ${n * 2})`); n *= 2; }
      for (const ci of p24Mine(/^double all damage that sources you control of the chosen type would deal\.?$/m)){ const ty = ci.ctype; if (!ty) continue; const tl = srcCard ? typeOf(srcCard) : (info(srcK)?.t || ''); if (new RegExp('\\b' + ty + '\\b', 'i').test(tl)){ log(`${cname(ci)}: ${ty} damage doubled (${n} → ${n * 2})`); n *= 2; } }
      for (const r of rulesOn('p24plus')){
        if (r.oppOnly && !opp) continue; if (r.playerOnly && !toPlayer) continue; if (r.nonCmb && cmb) continue;
        if (r.other && srcCard && cname(srcCard) === r.src) continue; if (r.other && !srcCard && info(srcK)?.n === r.src) continue;
        if (r.redArt){ const col = (srcCard && srcCard.k ? info(srcCard.k)?.c : info(srcK)?.c) || ''; const ty = srcCard ? typeOf(srcCard) : (info(srcK)?.t || ''); if (!/R/.test(col) && !/Artifact/.test(ty)) continue; }
        log(`${r.src}: +${r.n} damage`); n += r.n; }
      if (S.p24x3 === T && opp){ log(`damage tripled (${n} → ${n * 3})`); n *= 3; }
      // excess damage (computed by the dealer for "if excess damage was dealt this way")
      if (t.t === 'card'){ const tc = boardOf(t.pid).find(b => b.id === t.id); if (tc && (isCreatureCard(tc) || isPW(tc))){
        const left = p24LethalLeft(tc, t.pid, srcCard ? kwOf(srcCard, 'deathtouch') : false);
        if (UI.p24ram && srcCard && kwOf(srcCard, 'trample') && n > left){ after = {pid:t.pid, n:n - left}; n = left; log(`trample: ${after.n} excess damage is dealt to ${nameOf(after.pid)} instead`); }
        const ex = Math.max(0, n - left); if (UI.curCtx){ UI.curCtx.p24exc = (UI.curCtx.p24exc || 0) + ex; } } }
      // replacements of the damage event
      if (toPlayer && opp && rulesOn('p24mind').length){ log(`damage to ${nameOf(t.pid)} is prevented — each opponent mills ${n} (${rulesOn('p24mind')[0].src})`); opponents().forEach(p => sendRq(p.pid, 'mill', n, rulesOn('p24mind')[0].src)); return; }
      if (toPlayer && opp && cmb && mineSrc && /\bZombie\b/.test(typeOf(srcCard)) && rulesOn('p24alch').length){ log(`${cname(srcCard)}: instead ${nameOf(t.pid)} mills ${n} (Undead Alchemist)`); sendRq(t.pid, 'mill', n, 'Undead Alchemist'); return; }
      // damage that can't be prevented ignores creature-source prevention shields
      if (extra.p24np){ hide = [[S, S.r23prev]]; S.r23prev = []; for (const st of OPP.values()){ hide.push([st, st.r23prev]); st.r23prev = []; } }
    } } catch (e){ console.warn(e); }
    try { const r = n > 0 ? dd(t, n, srcK, srcCard, extra) : undefined;
      if (after) dd({t:'player', pid:after.pid}, after.n, srcK, srcCard, extra);
      return r; }
    finally { if (hide) hide.forEach(([st, v]) => { st.r23prev = v; }); }
  };
  const sf = srcFlags;
  srcFlags = function(k, pid, card){ const o = sf(k, pid, card); try { if (S && rulesOn('p24wither').length) o.wi = true; } catch {} return o; };
  // fog effects don't stop combat damage that can't be prevented
  const ad = attackerDamage;
  attackerDamage = async function(...a){
    const np = S && (S.p24np === p24T() || rulesOn('p24np').some(r => r.who === 'all' || r.pid === MYPID));
    if (!np) return ad.apply(this, a);
    const keep = [[S, S.fog]]; S.fog = ''; for (const st of OPP.values()){ keep.push([st, st.fog]); st.fog = 0; }
    try { return await ad.apply(this, a); } finally { keep.forEach(([st, v]) => { st.fog = v; }); }
  };
  // creatures that entered this turn (Neriv)
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && pid === MYPID && ev && ev.type === 'enter'){ const c = S.bf.find(b => b.id === ev.id); if (c) c.p24et = p24T(); } } catch {} return he(pid, ev); };
}

/* ---------- receiving side: damage to me ---------- */
function p24Prevented(n, why){ if (n <= 0) return; log(`${n} damage to me prevented${why ? ' (' + why + ')' : ''}`); emit({type:'p24prev', k:'', id:0, cnt:1, amt:n});
  const pt = S.p24prevTok; if (pt && pt.t === p24T() && !UI.dry){ (async () => { for (let i = 0; i < Math.min(n, 30); i++) await createFromText('Create ' + pt.d, {name:pt.src, k:null, it:{}}); commit(); })(); } }
function p24Redirect(n, f, why){ // returns true when the damage went elsewhere
  const T = p24T();
  const g = S.p24gid; if (g && g.t === T){ const c = S.bf.find(b => b.id === g.id); if (c){ log(`${n} damage is dealt to ${cname(c)} instead (${g.src})`); damageCard(c, n, f); return true; } }
  for (const r of rulesOn('p24adam')){ const c = S.bf.find(b => b.k && !b.fd && info(b.k)?.n === r.src); if (c && why !== c){ log(`${n} damage is dealt to ${cname(c)} instead`); damageCard(c, n, f); return true; } }
  if (why) return false;
  for (const r of rulesOn('p24redir')){ const a = S.bf.find(b => b.k && !b.fd && info(b.k)?.n === r.src && b.att); const h = p24Host(a); const hc = p24HostCard(h); if (!hc) continue;
    log(`${n} damage is dealt to ${cname(hc)} instead (${r.src})`); if (h.pid === MYPID) damageCard(hc, n, f); else sendRq(h.pid, 'dmg', n, r.src, {tid:h.id, f}); return true; }
  return false;
}
{
  const dm = damageMe;
  damageMe = function(n, f = {}, from){
    if (!S || !(n > 0)) return dm(n, f, from);
    const T = p24T(); f = f || {};
    try {
      if (!f.p24np){
        if (S.fogMe === T && f.p24c){ p24Prevented(n, 'combat damage'); return; }
        const cu = S.p24comeup; if (cu && cu.t === T && from && from !== MYPID){ p24Prevented(n, cu.src); p24Reflect(cu, n, f, from); return; }
        const pa = S.p24palm; if (pa && pa.t === T && from === pa.pid && f.p24s === pa.id){ S.p24palm = null; p24Prevented(n, pa.src); dealDamage({t:'player', pid:from}, n, pa.k, null); log(`${pa.src} deals ${n} damage to ${nameOf(from)}`); return; }
      }
      if (p24Redirect(n, f, null)) return;
    } catch (e){ console.warn(e); }
    const b = [S.life, S.psn]; const r = dm(n, f, from);
    try { if (S.life === b[0] && S.psn === b[1]){
      if (f.p24np){ if (f.inf) S.psn += n; else S.life -= n; log(`${n} damage can't be prevented → ${f.inf ? S.psn + ' poison' : S.life}`); if (f.cmd && from){ const key = from + '|' + f.cmd; S.cdt[key] = (S.cdt[key] || 0) + n; } }
      else p24Prevented(n, ''); } } catch {}
    return r;
  };
}
function p24Reflect(cu, n, f, from){
  if (/Creature/.test(f.types || '') && Number.isFinite(f.p24s)) dealDamage({t:'card', pid:from, id:f.p24s}, n, cu.k, null);
  else dealDamage({t:'player', pid:from}, n, cu.k, null);
}

/* ---------- receiving side: damage to my permanents ---------- */
{
  const dc = damageCard;
  damageCard = function(c, n, f = {}){
    if (!S || !c || !(n > 0) || !S.bf.includes(c)) return dc(c, n, f);
    f = f || {}; const T = p24T(); const tx = p24Txt(c); const cr = isCreatureCard(c);
    try {
      if (f.p24x) c.p24exDie = T;
      if (!f.p24np){
        const from = UI.p24from;
        if (cr && S.p24surge && S.p24surge.t === T && /[BR]/.test(f.col || '')){ log(`damage to ${cname(c)} prevented (${S.p24surge.src})`); return 0; }
        if (cr && S.p24fogCr === T && f.p24c){ log(`combat damage to ${cname(c)} prevented`); return 0; }
        if ((c.ekw || []).includes('p24nodmg')){ log(`damage to ${cname(c)} prevented`); return 0; }
        const cu = S.p24comeup; if (cu && cu.t === T && isPW(c) && from && from !== MYPID){ log(`damage to ${cname(c)} prevented (${cu.src})`); p24Reflect(cu, n, f, from); return 0; }
        if (/^if damage would be dealt to ~, prevent that damage and put that many \+1\/\+1 counters on (?:him|her|them)\.?$/m.test(tx)){ modCounters(c, 'cp', n); log(`${cname(c)}: ${n} damage prevented — ${n} +1/+1 counters instead`); return 0; }
        if (/^if damage would be dealt to ~, prevent that damage\. when damage is prevented this way, ~ deals that much damage to any other target\.?$/m.test(tx)){
          log(`${cname(c)}: ${n} damage prevented`);
          if (!UI.dry){ const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm:cname(c), txt:`~ deals ${n} damage to any target.`, srcId:c.id, evN:n}; S.stk.push(it); S.pass = 's:' + it.sid; log(`trigger: ${cname(c)} — deals ${n} damage to any other target`); commit(); }
          return 0; }
        if (/^if damage would be dealt to ~, prevent that damage and an opponent of your choice gains control of it\.?$/m.test(tx)){
          log(`${cname(c)}: ${n} damage prevented`); if (!UI.dry && !c.p24kh){ c.p24kh = 1; (async () => { try { const pid = await choosePlayer(`${cname(c)}: an opponent of your choice gains control of it`, true); if (pid && S.bf.includes(c)) giveAway(c, pid, {}); } finally { c.p24kh = 0; } commit(); })(); } return 0; }
        if (cr && rulesOn('p24vigor').some(r => r.src !== cname(c))){ modCounters(c, 'cp', n); log(`damage to ${cname(c)} prevented — ${n} +1/+1 counter${n === 1 ? '' : 's'} instead (Vigor)`); return 0; }
      }
      if (!/^all damage that would be dealt to you and other permanents you control is dealt to ~ instead/m.test(tx) && p24Redirect(n, f, c)) return 0;
    } catch (e){ console.warn(e); }
    let left = 0; try { if (cr || isPW(c)) left = p24LethalLeft(c, MYPID, f.dt); } catch {}
    let r = dc(c, n, f);
    try {
      if (!r && f.p24np && S.bf.includes(c)){ if (isPW(c) || isBattle(c)){ c.co = Math.max(0, (c.co || 0) - n); } else if (f.inf || f.wi){ c.cm = (c.cm || 0) + n; cancelCounters(c); } else c.dmg = (c.dmg || 0) + n; if (f.dt) c.dtd = 1; r = n; log(`${n} damage to ${cname(c)} can't be prevented`); }
      if (r > 0 && (cr || isPW(c)) && r > left && !UI.dry) emit({type:'p24exc', k:c.k, id:c.id, cnt:1, amt:r - left, x:f.p24c ? 1 : 0});
    } catch {}
    return r;
  };
  // "Damage isn't removed from ~ during cleanup steps"
  const sp = setPhase;
  setPhase = function(i, ...a){ const keep = i === 7 && S ? S.bf.filter(c => c.dmg && /^damage isn't removed from ~ during cleanup steps\.?$/m.test(tname(info(c.k)?.o || '', info(c.k)?.n || '').toLowerCase())).map(c => [c, c.dmg]) : [];
    const r = sp.call(this, i, ...a); if (keep.length){ keep.forEach(([c, d]) => { if (S.bf.includes(c)) c.dmg = d; }); commit(); } return r; };
}
// excess damage seen this turn (Rith) and trigger for Fall of Cair Andros
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ try { if (S && ev && ev.type === 'p24exc'){ if (!S.p24exSeen || S.p24exSeen.t !== p24T()) S.p24exSeen = {t:p24T(), pids:[]}; if (!S.p24exSeen.pids.includes(pid)) S.p24exSeen.pids.push(pid); } } catch {} return he(pid, ev); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^damage that would be dealt to you is prevented$/.test(c)) return {ev:'p24prev', subj:'any', ctl:'any', desc:''};
    let m;
    if ((m = c.match(/^a creature an opponent controls is dealt excess (noncombat )?damage$/))) return {ev:'p24exc', subj:'any', ctl:'opp', desc:'creature', p24non:!!m[1]};
    if ((m = c.match(/^(equipped|enchanted) creature is dealt damage$/))) return {ev:'dealt', subj:'any', ctl:'any', desc:'', p24host:m[1]};
    return ct(w, c);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){
    if (ev && ev.type === 'p24prev') return pid === MYPID;
    if (t && t.p24non && ev && ev.x) return false;
    if (t && t.p24host){ const s = S.bf.find(b => b.id === src.id); return !!(s && s.att && s.att.id === ev.id && (s.att.pid || MYPID) === pid); }
    return sm(t, src, ev, pid);
  };
}

/* ---------- "dealt damage this way" pre-scans (Anger of the Gods, Ram Through) ---------- */
{
  const re = runEffects;
  runEffects = async function(txt, ctx){
    const t = String(txt || '').toLowerCase(); const ex = /if (?:a|any) (?:creature|permanent) dealt damage this way would die this turn, exile it instead/.test(t); const ram = /if the creature you control has trample, excess damage is dealt to that creature's controller instead/.test(t);
    const w0 = UI.p24exDie, w1 = UI.p24ram; if (ex) UI.p24exDie = true; if (ram) UI.p24ram = true;
    try { return await re(txt, ctx); } finally { if (ex) UI.p24exDie = w0; if (ram) UI.p24ram = w1; }
  };
  const gr = gyReplace;
  gyReplace = function(c, from){ try { if (S && !UI.dry && from === 'bf' && c && c.p24exDie === p24T()) return 'ex'; } catch {} return gr(c, from); };
}

async function doRound24PPre(s, l, ctx){
  let m; const name = ctx.name || ''; const T = p24T();
  const say = t => doSentence(cap(t), ctx);
  const src = () => srcCardOf(ctx);
  const nm = name.toLowerCase();
  const self = x => x.split(nm).join('~');
  // ---- prevention shields
  if (/^prevent all damage that would be dealt to you and planeswalkers you control this turn by sources you don't control$/.test(l)){ S.p24comeup = {t:T, k:ctx.k, src:name}; log(`${name}: damage from sources ${'you'} don't control is prevented this turn`); commit(); return true; }
  if (/^if damage from a (?:creature|noncreature) source is prevented this way, .+ deals that much damage to (?:that creature|the source's controller)$/.test(l) && /prevent all damage that would be dealt to you and planeswalkers you control this turn by sources you don't control/i.test(ctx.full || '')) return true;
  if (/^the next time a source of your choice would deal damage to you this turn, prevent that damage$/.test(l)){
    const opts = []; for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd) opts.push({label:`${nameOf(pid)}: ${info(c.k)?.n}`, value:pid + '|' + c.id}); });
    if (UI.dry || !opts.length){ if (!UI.dry) log(`${name}: no source to choose`); return true; }
    const v = await askChoice({title:`${name}: choose a source`, options:opts}); if (!v) return true; const [pid, id] = String(v).split('|');
    S.p24palm = {t:T, pid, id:+id, k:ctx.k, src:name}; log(`${name}: the next damage ${opts.find(o => o.value === v).label} would deal to you this turn is prevented`); commit(); return true; }
  if (/^if damage is prevented this way, .+ deals that much damage to that source's controller$/.test(l) && /the next time a source of your choice would deal damage to you this turn, prevent that damage/i.test(ctx.full || '')) return true;
  if (/^prevent all damage that black and\/or red sources would deal to creatures you control this turn$/.test(l)){ S.p24surge = {t:T, src:name}; log(`${name}: damage from black and red sources to creatures you control is prevented this turn`); commit(); return true; }
  if (/^prevent all combat damage that would be dealt to creatures you control this turn$/.test(l)){ S.p24fogCr = T; log(`${name}: combat damage to creatures you control is prevented this turn`); commit(); return true; }
  if (/^prevent all damage that would be dealt to those permanents this turn$/.test(l) && /permanents you control with counters on them/i.test(ctx.full || '')){
    const list = S.bf.filter(c => !c.fd && ((c.cp || 0) + (c.cm || 0) + (c.co || 0) + (c.lore || 0) + Object.values(c.nc || {}).reduce((a, x) => a + (+x || 0), 0)) > 0);
    list.forEach(c => { c.ekw = [...new Set([...(c.ekw || []), 'p24nodmg'])]; }); if (list.length) log(`${name}: damage to ${list.length} permanent${list.length === 1 ? '' : 's'} is prevented this turn`); commit(); return true; }
  if ((m = l.match(/^for each 1 damage prevented this way, create (an? .+? tokens? with [a-z ,]+|an? .+? tokens?)$/)) && /prevent all combat damage that would be dealt to you this turn/i.test(ctx.full || '')){ S.p24prevTok = {t:T, d:s.slice(s.length - m[1].length), src:name}; return true; }
  if (/^damage can't be prevented this turn$/.test(l)){ S.p24np = T; log(`${name}: damage can't be prevented this turn`); commit(); return true; }
  if (/^if a source you control would deal damage this turn to an opponent or a permanent an opponent controls, it deals triple that damage instead$/.test(l)){ S.p24x3 = T; log(`${name}: damage to opponents and their permanents is tripled this turn`); commit(); return true; }
  if (/^choose a creature or planeswalker you control$/.test(l) && /is dealt to the chosen permanent instead/i.test(ctx.full || '')){
    const list = S.bf.filter(c => !c.fd && (isCreatureCard(c) || isPW(c))); if (UI.dry || !list.length){ ctx.p24pick = list[0] ? list[0].id : null; return true; }
    const ids = await pickCards({title:`${name}: choose a creature or planeswalker you control`, cards:list, min:1, max:1}); ctx.p24pick = ids && ids[0]; return true; }
  if (/^all damage that would be dealt this turn to you and permanents you control is dealt to the chosen permanent instead$/.test(l)){ if (ctx.p24pick != null){ const c = S.bf.find(b => b.id === ctx.p24pick); S.p24gid = {t:T, id:ctx.p24pick, src:name}; log(`${name}: damage to you and your permanents is dealt to ${c ? cname(c) : 'the chosen permanent'} this turn`); commit(); } return true; }
  // ---- "dealt damage this way" (handled by the pre-scan around the whole effect)
  if (/^if (?:a|any) (?:creature|permanent) dealt damage this way would die this turn, exile it instead$/.test(l) && UI.p24exDie) return true;
  if (/^if the creature you control has trample, excess damage is dealt to that creature's controller instead$/.test(l) && UI.p24ram) return true;
  // ---- excess damage
  if ((m = l.match(/^if excess damage was dealt(?: to a permanent)? this way, (.+)$/)) || (m = l.match(/^if the creature the opponent controls is dealt excess damage this way, (.+)$/))){
    const n = UI.dry ? 0 : (ctx.p24exc || 0); if (!n){ log(`${name}: no excess damage`); return true; }
    let rest = s.slice(s.length - m[1].length).replace(/, where x is that excess damage$/i, '').replace(/\bthat many\b/i, String(n)).replace(/\bdiscover x\b/i, `discover ${n}`);
    if (/^add that much \{r\}$/i.test(rest)){ addMana(Array(n).fill('R')); log(`${name}: added ${'{R}'.repeat(n)}`); commit(); return true; }
    await say(rest); return true; }
  if ((m = l.match(/^if a creature or planeswalker an opponent controlled was dealt excess damage this turn, (.+)$/))){
    const seen = S.p24exSeen && S.p24exSeen.t === T && S.p24exSeen.pids.some(p => p !== MYPID); if (!seen && !UI.dry){ log(`${name}: no opponent's creature or planeswalker was dealt excess damage this turn`); return true; }
    await say(s.slice(s.length - m[1].length)); return true; }
  if ((m = l.match(/^if (.+?) dealt damage to another creature this turn, (.+)$/)) && (m[1] === nm || m[1] === '~' || nm.startsWith(m[1] + ','))){
    const c = src(); if (!UI.dry && !(c && c.p24dmgCr === T)){ log(`${name} didn't deal damage to another creature this turn`); return true; }
    await say(s.slice(s.length - m[2].length).replace(/ on (?:him|her)$/i, ' on ' + name)); return true; }
  if (/^it deals that much damage to any target$/.test(l) && ctx.it && ctx.it.evId != null){
    const c = S.bf.find(b => b.id === ctx.it.evId); const n = ctx.it.evN || 0; const t = (ctx.tgts ? nextTargets(ctx) : [])[0];
    if (c && t && n > 0){ dealDamage(t, n, c.k, c); log(`${cname(c)} deals ${n} damage`); commit(); } return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24PPre(s, l, ctx)) return; return ds(s0, ctx); }; }
// creature-to-creature damage this turn (Wolverine)
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){ try { if (S && n > 0 && t && t.t === 'card' && srcCard && S.bf.includes(srcCard) && t.id !== srcCard.id){ const tc = boardOf(t.pid).find(b => b.id === t.id); if (tc && isCreatureCard(tc)) srcCard.p24dmgCr = p24T(); } } catch {} return dd(t, n, srcK, srcCard, extra); };
}

/* =================== draw replacements =================== */
STATIC_RULES.push(
  [/^if you would draw a card, draw two cards instead$/, m => ({kind:'p24draw2', who:'you'})],
  [/^if you would draw a card while you have no cards in hand, draw two cards instead$/, m => ({kind:'p24phial', who:'you'})],
  [/^if you would gain life while you have (\d+) or less life, you gain twice that much life instead$/, m => ({kind:'p24phialLife', who:'you', n:+m[1]})],
  [/^if you would draw a card, instead look at the top three cards of your library, then put one into your hand and the rest into your graveyard$/, m => ({kind:'p24lich', who:'you'})],
  [/^if you would draw a card, you may instead choose land or nonland and reveal cards from the top of your library until you reveal a card of the chosen kind$/, m => ({kind:'p24abund', who:'you'})],
  [/^put that card into your hand and put all other cards revealed this way on the bottom of your library in any order$/, m => ({kind:'noop'})],
  [/^if you would draw a card while your library has no cards in it, instead return a creature card from your graveyard to the battlefield$/, m => ({kind:'p24tombs', who:'you'})],
  [/^if you can't, you lose the game$/, m => ({kind:'noop'})],
  [/^if an opponent would draw two or more cards, instead you and that player each draw a card$/, m => ({kind:'p24alms', who:'opp'})],
  [/^if you would draw a card, exile the top two cards of your library instead$/, m => ({kind:'p24eruth', who:'you'})],
  [/^you may play those cards this turn$/, m => ({kind:'noop'})],
  [/^if you would draw a card, exile the top card of your library face down instead$/, m => ({kind:'p24asmo', who:'you'})],
);
P24.q = Promise.resolve();
function p24Later(fn){ P24.q = P24.q.then(fn).catch(e => console.warn(e)).then(() => { try { commit(); } catch {} }); }
{
  const dr = draw;
  draw = function(n = 1){
    if (!S || UI.dry || !(n > 0)) return dr(n);
    const T = p24T();
    const alms = rulesOn('p24alms');
    if (alms.length && n >= 2){ const r = alms[0]; log(`${r.src}: instead of drawing ${n}, draws a card and ${nameOf(r.pid)} draws a card`); sendRq(r.pid, 'draw', 1, r.src); n = 1; }
    const x2 = rulesOn('p24draw2').length, ph = rulesOn('p24phial').length, lich = rulesOn('p24lich')[0], ab = rulesOn('p24abund')[0], tb = rulesOn('p24tombs')[0], er = rulesOn('p24eruth')[0], as = rulesOn('p24asmo')[0];
    if (!x2 && !ph && !lich && !ab && !tb && !er && !as && S.p24ura !== T) return dr(n);
    let r;
    for (let i = 0; i < n; i++){
      if (S.p24ura === T){ S.p24ura = ''; const c = S.lib[0]; if (c){ moveCard(c.id, 'ex', {quiet:true}); grantPlay([c.id], {src:'Urabrask, Heretic Praetor'}); log(`instead of drawing, exiled ${cname(c)} (Urabrask) — may play it this turn`); } continue; }
      if (tb && !S.lib.length){ p24Later(async () => { const cr = S.gy.filter(c => isCreatureCard(c)); if (!cr.length){ S.r23kLost = 1; S.lost = `lost the game (${tb.src})`; log(`☠ ${tb.src}: no creature card to return — loses the game`); return; }
          const ids = await pickCards({title:`${tb.src}: return a creature card from your graveyard to the battlefield`, cards:cr, min:1, max:1, noClose:true}); const id = (ids || [cr[0].id])[0]; const c = S.gy.find(g => g.id === id); if (c){ moveCard(c.id, 'bf', {quiet:true}); log(`${tb.src}: returned ${cname(c)} to the battlefield instead of drawing`); } }); continue; }
      if (as){ const c = S.lib[0]; if (!c) continue; moveCard(c.id, 'ex', {quiet:true}); c.fdx = 1; c.p24asmo = 1; log(`${as.src}: exiled the top card of their library face down instead of drawing`); continue; }
      if (er){ const top = S.lib.slice(0, 2); top.forEach(c => moveCard(c.id, 'ex', {quiet:true})); if (top.length){ grantPlay(top.map(c => c.id), {src:er.src}); log(`${er.src}: exiled ${top.map(cname).join(' and ')} instead of drawing`); } continue; }
      if (lich){ p24Later(async () => { const top = S.lib.slice(0, 3); if (!top.length) return; const ids = top.length === 1 ? [top[0].id] : await pickCards({title:`${lich.src}: put one into your hand (the rest go to your graveyard)`, cards:top, min:1, max:1, noClose:true}); const keep = (ids || [top[0].id])[0];
          top.forEach(c => moveCard(c.id, c.id === keep ? 'hand' : 'gy', {quiet:true})); log(`${lich.src}: looked at the top ${top.length} cards instead of drawing — put one into hand, ${top.length - 1} into the graveyard`); }); continue; }
      if (ab){ p24Later(async () => { const v = await askChoice({title:`${ab.src}: draw normally, or reveal until a land / nonland card?`, options:[{label:'Draw normally', value:'draw'}, {label:'Land', value:'land'}, {label:'Nonland', value:'non'}]});
          if (v !== 'land' && v !== 'non'){ dr(1); return; }
          const rev = []; let hit = null; for (const c of S.lib.slice()){ if ((v === 'land') === !!isLand(c.k)){ hit = c; break; } rev.push(c); }
          if (hit) moveCard(hit.id, 'hand', {quiet:true}); rev.forEach(c => { const i = S.lib.indexOf(c); if (i >= 0){ S.lib.splice(i, 1); S.lib.push(c); } });
          log(`${ab.src}: revealed ${rev.length + (hit ? 1 : 0)} card${rev.length + (hit ? 1 : 0) === 1 ? '' : 's'}, put ${hit ? cname(hit) : 'nothing'} into hand and the rest on the bottom`); }); continue; }
      let k = 1; for (let j = 0; j < x2; j++) k *= 2; if (ph && !S.hand.length) k *= 2;
      if (k > 1) log(`draws ${k} cards instead of 1`);
      r = dr(k);
    }
    commit(); return r;
  };
  const gl = gainLife;
  gainLife = function(n, src){ try { if (S && n > 0){ for (const r of rulesOn('p24phialLife')) if (S.life <= r.n){ log(`${r.src}: gains twice that much life`); n *= 2; } } } catch {} return gl(n, src); };
}
RQ_OPS.push('p24ura', 'p24extake', 'p24exw', 'p24hitloss');
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r && r.op === 'p24ura'){ S.p24ura = p24T(); log(`${r.src}: the next time they would draw a card this turn, they exile the top card instead`); commit(); return; }
    if (r && r.op === 'p24exw'){ S.p24exw = S.p24exw || {}; const l = (S.p24exw[r.src] = S.p24exw[r.src] || []); l.push({k:r.d, pid:from}); if (l.length > 60) l.shift(); commit(); return; }
    if (r && r.op === 'p24extake'){ const i = S.ex.findIndex(c => c.k === r.d && !c.cmd); if (i >= 0){ const [g] = S.ex.splice(i, 1); const ref = rid(6); S.lent.push({ref, to:from, card:g, perm:true}); sendRq(from, 'give', 0, '', {ref, c:{k:g.k, cp:r.n || 0, tap:1}, f:{fromGy:1}}); log(`${nameOf(from)} put ${cname(g)} from my exile onto the battlefield (${r.src})`); } commit(); return; }
    if (r && r.op === 'p24hitloss'){ const n = S.ex.filter(c => c.p24hit).length; if (n){ S.life -= n; log(`loses ${n} life (${r.src}: cards in exile with a hit counter) → ${S.life}`); } commit(); return; }
    return ao(r, from);
  };
}

/* =================== death / graveyard / mill replacements =================== */
STATIC_RULES.push(
  [/^if a nontoken creature an opponent controls would die, instead exile it and you gain (\d+) life$/, m => ({kind:'p24dieEx', who:'opp', nontoken:true, life:+m[1]})],
  [/^if a creature an opponent controls would die, exile it instead$/, m => ({kind:'p24dieEx', who:'opp'})],
  [/^when you do, create (a 1\/1 green saproling creature token)$/, m => ({kind:'p24dieTok', who:'opp', tok:m[1]})],
  [/^if a creature an opponent controls would die, instead exile it and put a hit counter on it$/, m => ({kind:'p24dieEx', who:'opp', hit:true})],
  [/^if a card you didn't control would be put into an opponent's graveyard from anywhere, exile it instead$/, m => ({kind:'gyEx', who:'opp'})],
  [/^if an opponent would mill one or more cards, they mill that many cards plus (\w+) instead$/, m => ({kind:'p24millPlus', who:'opp', n:wn(m[1]) || +m[1] || 0})],
  [/^if ~ would be put into a graveyard from anywhere, exile it instead$/, m => ({kind:'noop'})],
  [/^if you would lose the game, instead exile ~ and your life total becomes 1$/, m => ({kind:'p24throne', who:'you'})],
);
{
  const gr = gyReplace;
  gyReplace = function(c, from){
    try { if (S && !UI.dry && c){
      if (S.p24gyEx === p24T()) return 'ex';
      if (c.fl && info(c.k)?.back && /^if ~ would be put into a graveyard from anywhere, exile it instead\.?$/im.test(tname(info(c.k).back.o || '', info(c.k).back.n || ''))) return 'ex';
      if (from === 'bf' && isCreatureCard(c)){
        const rs = rulesOn('p24dieEx').filter(r => !r.nontoken || !c.tok);
        if (rs.length){ const r = rs[0]; const all = staticRules().filter(x => x.pid === r.pid && x.src === r.src);
          if (r.life) sendRq(r.pid, 'life', r.life, r.src);
          if (!c.tok) sendRq(r.pid, 'p24exw', 0, r.src, {d:c.k});
          all.filter(x => x.kind === 'p24dieTok').forEach(x => sendRq(r.pid, 'tokText', 0, r.src, {d:p24Orig(r.src, x.tok)}));
          if (r.hit && !c.tok) c.p24hit = 1;
          log(`${cname(c)} is exiled instead of dying (${r.src})`); return 'ex'; }
      } } } catch (e){ console.warn(e); }
    return gr(c, from);
  };
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ let c = null; try { if (S && to !== 'bf'){ c = S.bf.find(b => b.id === id); if (c && c.p24exLeave && to !== 'ex'){ log(`${cname(c)} is exiled instead of leaving the battlefield another way`); to = 'ex'; } } } catch {} const r = mc(id, to, o); try { if (c && c.p24exLeave && !S.bf.includes(c)) delete c.p24exLeave; } catch {} return r; };
  const ml = mill;
  mill = function(n = 1, ...a){ try { if (S && n > 0){ for (const r of rulesOn('p24millPlus')){ log(`${r.src}: mills ${r.n} more`); n += r.n; } } } catch {} return ml(n, ...a); };
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a);
    try { if (S && S.lost && !UI.dry){ const th = rulesOn('p24throne')[0]; const c = th && S.bf.find(b => b.k && !b.fd && info(b.k)?.n === th.src); if (c){ moveCard(c.id, 'ex', {quiet:true}); S.life = 1; S.lost = ''; S.r23kLost = 0; S.g23lost = 0; log(`${th.src}: instead of losing the game, exiled it — life total becomes 1`); commit(); } } } catch (e){ console.warn(e); }
    return r; };
}

/* =================== token replacements =================== */
STATIC_RULES.push(
  [/^if one or more (creature|artifact) tokens would be created under your control, those tokens plus an? (?:additional )?(.+? token(?: with [a-z ,]+)?) are created instead$/, m => ({kind:'p24plusTok', who:'you', ty:m[1], tok:'a ' + m[2]})],
  [/^if you would create one or more (artifact )?tokens, instead create those tokens plus an additional (.+? token)$/, m => ({kind:'p24plusTok', who:'you', ty:(m[1] || '').trim(), tok:'a ' + m[2]})],
  [/^if one or more creature tokens would be created under your control, three times that many of those tokens are created instead$/, m => ({kind:'p24tokX', who:'you', ty:'creature', x:3})],
  [/^if you would create one or more tokens, you may instead create that many (\d+\/\d+ [a-z ]+? creature tokens with [a-z]+) or that many (\d+\/\d+ [a-z ]+? creature tokens with [a-z]+)$/, m => ({kind:'p24jinnie', who:'you', a:m[1], b:m[2]})],
  [/^as long as ~ is attached to a creature, the first time you would create one or more tokens each turn, you may instead create that many tokens that are copies of equipped creature$/, m => ({kind:'p24copyTok', who:'you', host:true})],
  [/^the first time you would create one or more tokens during each of your turns, you may instead choose a creature other than ~ and create that many tokens that are copies of that creature$/, m => ({kind:'p24copyTok', who:'you', pick:true, myTurn:true})],
);
{
  const ct = createToken;
  createToken = function(k, n = 1, near, o = {}){
    if (!S || UI.dry || P24.tokBusy) return ct(k, n, near, o);
    let rs; try {
      const T = p24T(); const ty = info(k)?.t || ''; const isCr = /\bCreature\b/.test(ty), isArt = /\bArtifact\b/.test(ty);
      let mult = 1; if (S.p24tokX2 === T){ mult *= 2; } for (const r of rulesOn('p24tokX')) if (r.ty !== 'creature' || isCr) mult *= r.x;
      if (mult > 1){ log(`${mult}× tokens (${n} → ${n * mult})`); n *= mult; }
      // "you may instead" replacements: ask, then create
      const cp = rulesOn('p24copyTok').filter(r => (!r.myTurn || currentTurn()[1] === MYPID) && (S.p24ft || {})[r.src] !== T);
      const jf = rulesOn('p24jinnie')[0];
      const opts = [];
      for (const r of cp){ if (r.host){ const a = S.bf.find(b => b.k && !b.fd && info(b.k)?.n === r.src && b.att); const hc = p24HostCard(p24Host(a)); if (hc) opts.push({label:`${n} cop${n === 1 ? 'y' : 'ies'} of ${info(hc.k)?.n} (${r.src})`, value:'cp|' + r.src, k:hc.k, r}); }
        else if (S.bf.some(b => !b.fd && isCreatureCard(b) && cname(b) !== r.src)) opts.push({label:`copies of a creature you choose (${r.src})`, value:'pick|' + r.src, r}); }
      if (jf){ opts.push({label:`${n} ${jf.a.replace(/tokens/, n === 1 ? 'token' : 'tokens')}`, value:'ja'}); opts.push({label:`${n} ${jf.b.replace(/tokens/, n === 1 ? 'token' : 'tokens')}`, value:'jb'}); }
      if (opts.length){
        const N = n; p24Later(async () => {
          const v = await askChoice({title:`Creating ${N} ${info(k)?.n} token${N === 1 ? '' : 's'} — replace them?`, options:[{label:`Keep ${info(k)?.n}`, value:'keep'}, ...opts.map(x => ({label:x.label, value:x.value}))]});
          const op = opts.find(x => x.value === v);
          if (op && op.r) (S.p24ft = S.p24ft || {})[op.r.src] = T;
          P24.tokBusy = (P24.tokBusy || 0) + 1;
          try {
            if (!op){ ct(k, N, near, o); p24PlusTok(k); return; }
            if (v === 'ja' || v === 'jb'){ const d = p24Orig(jf.src, v === 'ja' ? jf.a : jf.b); await createFromText(`Create ${N} ${d}`, {name:jf.src, k:null, it:{}}); log(`${jf.src}: created ${d} instead`); return; }
            let kk = op.k; if (v.startsWith('pick|')){ const list = S.bf.filter(b => !b.fd && isCreatureCard(b) && cname(b) !== op.r.src); const ids = await pickCards({title:`${op.r.src}: choose a creature to copy`, cards:list, min:1, max:1, noClose:true}); const c = S.bf.find(b => b.id === (ids || [])[0]) || list[0]; kk = c && c.k; }
            if (kk){ ct(kk, N, near, o); log(`${op.r.src}: created ${N} token cop${N === 1 ? 'y' : 'ies'} of ${info(kk)?.n} instead`); p24PlusTok(kk); }
          } finally { P24.tokBusy--; }
        });
        return;
      }
    } catch (e){ console.warn(e); }
    const r = ct(k, n, near, o); p24PlusTok(k); return r;
  };
}
function p24PlusTok(k){
  try { if (!S || UI.dry || P24.plusBusy) return; const ty = info(k)?.t || '';
    const rs = rulesOn('p24plusTok').filter(r => !r.ty || new RegExp('\\b' + r.ty + '\\b', 'i').test(ty)); if (!rs.length) return;
    P24.plusBusy = true; (async () => { try { for (const r of rs){ await createFromText('Create ' + p24Orig(r.src, r.tok), {name:r.src, k:null, it:{}}); log(`${r.src}: plus ${r.tok}`); } } finally { P24.plusBusy = false; } commit(); })();
  } catch (e){ console.warn(e); }
}

async function doRound24PPre2(s, l, ctx){
  let m; const name = ctx.name || ''; const T = p24T();
  const say = t => doSentence(cap(t), ctx);
  if (/^if it would leave the battlefield, exile it instead of putting it anywhere else$/.test(l)){
    const id = ctx.lastCardId != null ? ctx.lastCardId : ((ctx.lastT || [])[0] || {}).id; const c = id != null && S.bf.find(b => b.id === id);
    if (c){ c.p24exLeave = 1; log(`${cname(c)}: if it would leave the battlefield, it's exiled instead`); commit(); } return true; }
  if (/^if a card would be put into your graveyard from anywhere this turn, exile (?:that card|it) instead$/.test(l)){ S.p24gyEx = T; log(`${name}: cards going to your graveyard this turn are exiled instead`); commit(); return true; }
  if ((m = l.match(/^put target creature card exiled with (.+?) onto the battlefield tapped under your control with two additional \+1\/\+1 counters on it$/))){
    const src = (S.p24exw || {})[name] || []; if (UI.dry || !src.length){ if (!UI.dry) log(`${name}: no creature card exiled with it`); return true; }
    const v = await askChoice({title:`${name}: put a creature card exiled with it onto the battlefield`, options:src.map((x, i) => ({label:`${info(x.k)?.n} (${nameOf(x.pid)})`, value:String(i)}))}); const x = src[+v]; if (!x) return true;
    src.splice(+v, 1); sendRq(x.pid, 'p24extake', 2, name, {d:x.k}); log(`${name}: puts ${info(x.k)?.n} onto the battlefield under their control`); commit(); return true; }
  if ((m = l.match(/^return all cards exiled with (.+?) to their owner's hand and you lose that much life$/))){
    const list = S.ex.filter(c => c.p24asmo); list.forEach(c => { delete c.p24asmo; moveCard(c.id, 'hand', {quiet:true}); }); if (list.length){ S.life -= list.length; log(`${name}: returned ${list.length} card${list.length === 1 ? '' : 's'} to hand and lost ${list.length} life → ${S.life}`); } commit(); return true; }
  if (/^defending player loses 1 life for each card they own in exile with a hit counter on it$/.test(l)){ const pid = ctx.it && ctx.it.evDp; if (pid && pid !== MYPID && !UI.dry) sendRq(pid, 'p24hitloss', 0, name); return true; }
  if (/^target player loses 1 life for each card they own in exile with a hit counter on it$/.test(l)){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; if (t && t.pid && t.pid !== MYPID && !UI.dry) sendRq(t.pid, 'p24hitloss', 0, name); return true; }
  if (/^the next time they would draw a card this turn, instead they exile the top card of their library$/.test(l)){ const pid = ctx.it && ctx.it.evPid; if (pid && pid !== MYPID && !UI.dry) sendRq(pid, 'p24ura', 0, name); return true; }
  if (/^they may play it this turn$/.test(l) && /the next time they would draw a card this turn, instead they exile the top card/i.test(ctx.full || '')) return true;
  if (/^until end of turn, if one or more tokens would be created under your control, twice (?:that many|\d+) of those tokens are created instead$/.test(l)){ S.p24tokX2 = T; log(`${name}: tokens are doubled this turn`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24PPre2(s, l, ctx)) return; return ds(s0, ctx); }; }

/* =================== combat requirements and restrictions =================== */
STATIC_RULES.push(
  [/^other (\w+?)s? creatures you control attack each combat if able$/, m => ({kind:'p24mustAtk', who:'you', ty:m[1], other:true})],
  [/^(\w+?)s? you control attack each combat if able$/, m => ({kind:'p24mustAtk', who:'you', ty:m[1]})],
  [/^~ attacks or blocks each combat if able$/, m => ({kind:'p24selfMust', who:'you'})],
  [/^if a creature an opponent controls attacks, all creatures that opponent controls attack if able$/, m => ({kind:'p24warsToll', who:'opp'})],
  [/^~ can only attack alone$/, m => ({kind:'p24alone', who:'you'})],
  [/^as long as ~ is tapped, no more than one creature can attack you each combat$/, m => ({kind:'p24mirriT', who:'opp'})],
  [/^no more than one creature can attack ~ each combat$/, m => ({kind:'p24pwOne', who:'opp'})],
  [/^creatures named ([a-z ,'-]+) can't attack you or planeswalkers you control$/, m => ({kind:'p24noAtkYou', who:'opp', named:m[1]})],
  [/^(\w+?)s? can't attack you or planeswalkers you control$/, m => ({kind:'p24noAtkYou', who:'opp', ty:m[1]})],
  [/^(\w+?)s? your opponents control can't block, and they can't attack you or planeswalkers you control$/, m => ({kind:'p24noAtkYou', who:'opp', ty:m[1], noBlk:true})],
  [/^creatures with power greater than the number of cards in your hand can't attack$/, m => ({kind:'p24bridge', who:'all'})],
  [/^each opponent who cast a spell this turn can't attack with creatures$/, m => ({kind:'p24arbA', who:'opp'})],
  [/^each opponent who attacked with a creature this turn can't cast spells$/, m => ({kind:'p24arbC', who:'opp'})],
  [/^all creatures able to block (?:~|enchanted creature|equipped creature) do so$/, m => ({kind:'p24lureS', who:'all'})],
  [/^creatures your opponents control without flying or reach can't block creatures with power (\d+) or less$/, m => ({kind:'p24sidar', who:'opp', n:+m[1]})],
  [/^(\w+?)s? can't block (\w+?)s?$/, m => ({kind:'p24tyNoBlk', who:'all', b:m[1], a:m[2]})],
  [/^(?:domain — )?creatures can't attack you unless their controller pays \{x\} for each creature they control that's attacking you, where x is the number of basic land types among lands you control$/, m => ({kind:'p24taxDom', who:'opp'})],
  [/^each creature with one or more counters on it can't attack you or planeswalkers you control unless its controller pays \{x\}, where x is the number of counters on that creature$/, m => ({kind:'p24taxCtr', who:'opp'})],
  [/^creatures can't attack planeswalkers you control unless their controller pays \{1\} for each creature they control that's attacking a planeswalker you control$/, m => ({kind:'p24taxPw', who:'opp'})],
);
const p24Ty = (c, ty) => new RegExp('\\b' + cap(ty.replace(/(?:ves)$/, 'f').replace(/ies$/, 'y')) + '(?:s)?\\b', 'i').test(typeOf(c));
function p24CarnOn(){ for (const [pid, st] of [[MYPID, S], ...OPP]){ const x = st && st.p24carn; if (!x || pid === MYPID && false) continue; const [n, ap] = currentTurn(); if (ap === pid && n > x.n) continue; if (pid !== MYPID) return pid; } return null; }
// why creature c (mine) must attack this combat, or ''
function p24MustAtk(c){
  if (!c || c.fd || !isCreatureCard(c)) return '';
  const T = p24T();
  for (const r of rulesOn('p24mustAtk')){ if (r.other && cname(c) === r.src) continue; if (p24Ty(c, r.ty)) return r.src; }
  if (/^~ attacks or blocks each combat if able\.?$/m.test(p24Txt(c))) return cname(c);
  if (c.p24mustT === T) return 'attacks this turn if able';
  if (c.p24hk && c.p24hk.t === T) return cname(c);
  if (p24CarnOn()) return 'Maximum Carnage';
  return '';
}
function p24AtkPlan(){ // checks my declared attackers; returns an error message or ''
  const T = p24T(); const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v).map(([id, d]) => [S.bf.find(x => x.id === +id), d]).filter(([c]) => c);
  const able = S.bf.filter(c => !c.fd && isCreatureCard(c) && !canAttack(c));
  const isSel = c => sel.some(([x]) => x === c);
  const miss = able.filter(c => p24MustAtk(c) && !isSel(c));
  if (miss.length) return `${miss.map(cname).slice(0, 4).join(', ')} must attack if able (${p24MustAtk(miss[0])})`;
  if (sel.length && rulesOn('p24warsToll').length){ const m2 = able.filter(c => !isSel(c)); if (m2.length) return `${rulesOn('p24warsToll')[0].src}: all your creatures must attack if any do (${m2.map(cname).slice(0, 3).join(', ')})`; }
  for (const [c, d] of sel){ const p = parseDef(d); const pid = p && attackTargetProtector(p);
    if (c.p24hk && c.p24hk.t === T && pid !== c.p24hk.pid && defOpts().some(o => o.key === 'p:' + c.p24hk.pid)) return `${cname(c)} must attack ${nameOf(c.p24hk.pid)} this combat`;
    const carn = p24CarnOn(); if (carn && pid === carn && defOpts().some(o => o.pid !== carn && o.key.startsWith('p:'))) return `Maximum Carnage: ${cname(c)} must attack a player other than ${nameOf(carn)} if able`;
    for (const r of rulesOn('p24noAtkYou')){ if (r.pid !== pid) continue; if ((r.named && cname(c).toLowerCase() === r.named) || (r.ty && p24Ty(c, r.ty))) return `${r.src}: ${cname(c)} can't attack ${nameOf(pid)}`; }
    if (p && p.t === 'card'){ const pw = boardOf(p.pid).find(x => x.id === p.id); if (pw && /^no more than one creature can attack ~ each combat\.?$/m.test(p24Txt(pw)) && sel.filter(([, d2]) => d2 === d).length > 1) return `No more than one creature can attack ${info(pw.k)?.n} each combat`; }
  }
  if (sel.length > 1){ const al = sel.find(([c]) => /^~ can only attack alone\.?$/m.test(p24Txt(c))); if (al) return `${cname(al[0])} can only attack alone`; }
  for (const [pid, st] of OPP){ const mi = (st.bf || []).some(b => b.k && !b.fd && b.tap && /^as long as ~ is tapped, no more than one creature can attack you each combat\.?$/m.test(p24Txt(b))); if (!mi) continue;
    const n = sel.filter(([, d]) => { const p = parseDef(d); return p && attackTargetProtector(p) === pid; }).reduce((a, [c]) => a + (c.n || 1), 0); if (n > 1) return `No more than one creature can attack ${nameOf(pid)} each combat`; }
  return '';
}
{
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { const pn = phaseNow(); if (pn.mine && S.cb && S.cb.step === 'atk'){ const err = p24AtkPlan(); if (err){ toast(err); return; } } } catch (e){ console.warn(e); }
    const r = da.apply(this, a);
    try { if (S.cb && S.cb.step !== 'atk'){ S.bf.forEach(c => { if (isCreatureCard(c)){ const p = parseDef(c.atk); c.p24prevAtk = p ? attackTargetProtector(p) : ''; } }); if (S.bf.some(c => c.atk && c.p24mirriA)) {} } } catch {}
    return r; };
  const preselect = () => { try { const pn = phaseNow(); if (!pn.mine || !S.cb || S.cb.step !== 'atk') return; const opts = defOpts(); if (!opts.length) return;
      S.bf.forEach(c => { if (canAttack(c) || UI.atkSel[c.id] || !p24MustAtk(c)) return; let key = opts[0].key; if (c.p24hk && c.p24hk.t === p24T() && opts.some(o => o.key === 'p:' + c.p24hk.pid)) key = 'p:' + c.p24hk.pid; const carn = p24CarnOn(); if (carn && parseDef(key)?.pid === carn){ const o2 = opts.find(o => o.pid !== carn && o.key.startsWith('p:')); if (o2) key = o2.key; } UI.atkSel[c.id] = key; }); } catch (e){ console.warn(e); } };
  const ac = advanceCombat;
  advanceCombat = function(...a){ const r = ac.apply(this, a); preselect(); return r; };
  const an = ACT.atkNone;
  ACT.atkNone = function(...a){ const r = an.apply(this, a); preselect(); renderCombatPanel(); return r; };
  const ca = canAttack;
  canAttack = function(c){ const w = ca(c); if (w) return w;
    try { if (S && c && S.bf.includes(c)){
      for (const r of rulesOn('p24bridge')){ const hc = r.pid === MYPID ? S.hand.length : (OPP.get(r.pid)?.hc || 0); const st = stats(c); if (st && st[0] > hc) return `can't attack (${r.src}: power greater than ${hc})`; }
      const arb = rulesOn('p24arbA')[0]; if (arb && (S.casts || []).some(x => x.t === p24T())) return `can't attack (${arb.src}: you cast a spell this turn)`;
    } } catch {} return ''; };
  const cc = castCheck;
  castCheck = function(c, zone, ...a){ const r = cc(c, zone, ...a); try { if (r && r.ok && S && c && !isLand(c.k)){ const arb = rulesOn('p24arbC')[0]; if (arb && S.r23atk && S.r23atk.t === p24T() && S.r23atk.ids.length) return {ok:false, why:`${arb.src}: you attacked with a creature this turn, so you can't cast spells`}; } } catch {} return r; };
}
// attack taxes (Collective Restraint, Nils, Onakke Oathkeeper) on top of engine23f's
{
  const tf = r23fTaxFor;
  r23fTaxFor = function(pid, n){ const o = tf(pid, n);
    try { const st = OPP.get(pid); if (!st) return o; const bf = st.bf || []; o.why = o.why || [];
      const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v).map(([id, d]) => [S.bf.find(x => x.id === +id), parseDef(d)]).filter(([c, p]) => c && p && attackTargetProtector(p) === pid);
      for (const e of bf){ if (!e.k || e.fd) continue; const t = p24Txt(e);
        if (/(?:^|— )creatures can't attack you unless their controller pays \{x\} for each creature they control that's attacking you/m.test(t)){ const ty = new Set(); bf.forEach(l => { if (l.k && !l.fd && isLand(l.k)) (info(l.k)?.t || '').split(/[\s—]+/).forEach(w => { if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(w)) ty.add(w); }); });
          const k = sel.filter(([, p]) => p.t === 'player').reduce((a, [c]) => a + (c.n || 1), 0); if (k && ty.size){ o.gen += ty.size * k; o.why.push(`${info(e.k).n}: {${ty.size}} × ${k}`); } }
        if (/^each creature with one or more counters on it can't attack you or planeswalkers you control unless its controller pays \{x\}/m.test(t)){ let x = 0; sel.forEach(([c]) => { x += (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((a, v) => a + (+v || 0), 0); }); if (x){ o.gen += x; o.why.push(`${info(e.k).n}: {${x}}`); } }
        if (/^creatures can't attack planeswalkers you control unless their controller pays \{1\} for each creature they control that's attacking a planeswalker you control/m.test(t)){ const k = sel.filter(([, p]) => p.t === 'card').reduce((a, [c]) => a + (c.n || 1), 0); if (k){ o.gen += k; o.why.push(`${info(e.k).n}: {1} × ${k}`); } }
      } } catch (e){ console.warn(e); }
    return o; };
}
// blocking requirements and restrictions (checked on the defender's own client)
function p24IsLure(a, apid){
  if ((a.ekw || []).includes('p24lure')) return true;
  if (/^all creatures able to block ~ do so\.?$/m.test(p24Txt(a))) return true;
  for (const b of boardsAll()) for (const s of b.bf){ if (!s.att || s.att.id !== a.id || (s.att.pid || b.pid) !== apid || !s.k || s.fd) continue; if (/^all creatures able to block (?:enchanted|equipped) creature do so\.?$/m.test(p24Txt(s))) return true; }
  return false;
}
{
  const cb = canBlock;
  canBlock = function(b, a, apid){ const w = cb(b, a, apid); if (w) return w;
    try { if (S && b && a && S.bf.includes(b)){
      for (const r of rulesOn('p24sidar')){ if (r.pid !== apid) continue; if (kwOf(b, 'flying') || kwOf(b, 'reach')) continue; const st = stats(a, apid); if (st && st[0] <= r.n) return `can't block (${r.src})`; }
      for (const r of rulesOn('p24tyNoBlk')) if (p24Ty(b, r.b) && p24Ty(a, r.a)) return `can't block (${r.src})`;
      for (const r of rulesOn('p24noAtkYou')) if (r.noBlk && r.ty && p24Ty(b, r.ty)) return `can't block (${r.src})`;
      for (const [pid, st] of [[MYPID, S], ...OPP]) if (st && st.p24nbnf === p24T() && !kwOf(b, 'flying')) return "can't block (creatures without flying can't block this turn)";
    } } catch {} return w; };
  const cfb = confirmBlocks;
  confirmBlocks = function(auto, ...a){
    try { const pn = phaseNow(); const cbx = cbOf(pn);
      if (!pn.mine && cbx && cbx.step === 'blk'){
        const atts = attackersOnMe(pn); const apid = pn.pid; const T = p24T(); const notes = []; let changed = false;
        const mine = S.bf.filter(b => !b.fd && isCreatureCard(b) && !b.tap);
        const can = (b, at) => !canBlock(b, at, apid);
        const selOf = b => { const v = UI.blkSel[b.id]; return v == null || v === '' ? null : +v; };
        const lures = atts.filter(at => p24IsLure(at, apid));
        const forced = new Set();
        for (const b of mine){
          const req = lures.filter(at => can(b, at)).concat(atts.filter(at => (b.ekw || []).includes('p24b:' + at.id) && can(b, at)));
          if (req.length){ forced.add(b.id); if (!req.some(at => at.id === selOf(b))){ UI.blkSel[b.id] = req[0].id; changed = true; notes.push(`${cname(b)} must block ${info(req[0].k)?.n}`); } continue; }
          if (/^~ attacks or blocks each combat if able\.?$/m.test(p24Txt(b)) && selOf(b) == null){ const at = atts.find(x => can(b, x)); if (at){ forced.add(b.id); UI.blkSel[b.id] = at.id; changed = true; notes.push(`${cname(b)} blocks each combat if able`); } }
        }
        for (const at of atts.filter(x => (x.ekw || []).includes('p24mbb'))){
          if (mine.some(b => selOf(b) === at.id)) continue;
          const b = mine.find(x => !forced.has(x.id) && selOf(x) == null && can(x, at)) || mine.find(x => !forced.has(x.id) && can(x, at));
          if (b){ UI.blkSel[b.id] = at.id; changed = true; notes.push(`${info(at.k)?.n} must be blocked if able — ${cname(b)} blocks it`); }
        }
        const st = OPP.get(apid);
        if (st && st.p24mirri === T){ const sel = mine.filter(b => selOf(b) != null); if (sel.length > 1){ if (!auto){ toast(`${nameOf(apid)}'s Mirri: you can't block with more than one creature this combat`); return; } sel.slice(1).forEach(b => { UI.blkSel[b.id] = ''; }); } }
        if (changed && !auto){ toast(notes.slice(0, 3).join(' · ')); renderCombatPanel(); return; }
      } } catch (e){ console.warn(e); }
    return cfb.call(this, auto, ...a); };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = p24T(); if (S.p24mirri === T) o.p24mirri = T; if (S.p24nbnf === T) o.p24nbnf = T; if (S.p24carn) o.p24carn = {n:+S.p24carn.n || 0}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s.p24mirri) o.p24mirri = String(s.p24mirri).slice(0, 20); if (s.p24nbnf) o.p24nbnf = String(s.p24nbnf).slice(0, 20); if (s.p24carn) o.p24carn = {n:+s.p24carn.n || 0}; } catch {} return o; };
}
async function doRound24PPre3(s, l, ctx){
  let m; const name = ctx.name || ''; const T = p24T(); const nm = name.toLowerCase();
  const src = () => srcCardOf(ctx); const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  const lastT = () => (ctx.lastT || [])[0];
  const isMe = x => x === '~' || x === nm || nm.startsWith(x + ',') || x === 'this creature' || x === 'it';
  if (/^all creatures able to block target creature this turn do so$/.test(l)){ const t = tgt(); if (t){ ctx.lastT = [t]; applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['p24lure']}}); log(`${name}: all creatures able to block ${t.nm || 'it'} this turn do so`); } commit(); return true; }
  if (/^that creature gains indestructible until end of turn if you control a creature with power 4 or greater$/.test(l)){ const t = lastT(); if (t && S.bf.some(c => isCreatureCard(c) && (stats(c) || [0])[0] >= 4)) applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['indestructible']}}); commit(); return true; }
  if ((m = l.match(/^(.+?) must be blocked each combat this turn if able$/)) && isMe(m[1])){ const c = src(); if (c){ c.ekw = [...new Set([...(c.ekw || []), 'p24mbb'])]; log(`${name} must be blocked this turn if able`); } commit(); return true; }
  if (/^that creature must be blocked this combat if able$/.test(l)){ const t = lastT(); if (t) applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['p24mbb']}}); commit(); return true; }
  if (/^up to one target creature blocks it this combat if able$/.test(l)){ const t = tgt(); const aid = ctx.it && ctx.it.evId; if (t && aid != null){ applyTo(t, {op:'pump', src:name, f:{p:0, t:0, kw:['p24b:' + aid]}}); log(`${name}: ${t.nm || 'that creature'} blocks it this combat if able`); } commit(); return true; }
  if (/^each opponent can't block with more than one creature this combat$/.test(l)){ S.p24mirri = T; log(`${name}: each opponent can't block with more than one creature this combat`); commit(); return true; }
  if (/^creatures without flying can't block this turn$/.test(l)){ S.p24nbnf = T; log(`${name}: creatures without flying can't block this turn`); commit(); return true; }
  if (/^until your next turn, each creature attacks each combat if able and attacks a player other than you if able$/.test(l)){ S.p24carn = {n:currentTurn()[0]}; log(`${name}: until your next turn, each creature attacks each combat if able`); commit(); return true; }
  if ((m = l.match(/^(.+?) and that creature each get \+(\d+)\/\+(\d+) and gain haste until end of turn and attack this turn if able$/)) && isMe(m[1])){
    const c = src(); const t = lastT(); const f = {p:+m[2], t:+m[3], kw:['haste']};
    if (c){ applyTo({t:'card', pid:MYPID, id:c.id}, {op:'pump', src:name, f}); c.p24mustT = T; }
    if (t && t.pid === MYPID){ applyTo(t, {op:'pump', src:name, f}); const tc = S.bf.find(b => b.id === t.id); if (tc) tc.p24mustT = T; }
    commit(); return true; }
  if ((m = l.match(/^choose an opponent at random that (.+?) didn't attack during your last combat$/))){
    const c = src(); const opts = opponents().filter(p => !(p.s && p.s.lost) && (!c || c.p24prevAtk !== p.pid));
    if (!opts.length){ ctx.p24hkNone = true; return true; } const p = opts[Math.floor(Math.random() * opts.length)]; ctx.p24hk = p.pid;
    if (c){ c.p24hk = {t:T, pid:p.pid}; log(`${name}: chose ${p.nm} at random — it attacks them this combat if able`); } commit(); return true; }
  if ((m = l.match(/^(.+?) attacks (?:that|target) player this combat if able$/)) && isMe(m[1]) && /choose an opponent at random/i.test(ctx.full || '')) return true;
  if ((m = l.match(/^if you can't choose an opponent this way, tap (.+)$/))){ if (ctx.p24hkNone){ const c = src(); if (c){ c.tap = true; log(`${name}: no opponent to choose — tapped`); } commit(); } return true; }
  if (/^if two or more of those creatures are attacking you and\/or planeswalkers you control, that opponent loses (\d+) life and you draw a card$/.test(l)){
    const pid = ctx.it && ctx.it.evPid; const n = +l.match(/loses (\d+)/)[1]; if (!pid || pid === MYPID || UI.dry) return true;
    const k = (OPP.get(pid)?.bf || []).filter(c => { const d = parseDef(c.atk); return d && attackTargetProtector(d) === MYPID; }).reduce((a, c) => a + (c.n || 1), 0);
    if (k >= 2){ sendRq(pid, 'life', -n, name); log(`${name}: ${nameOf(pid)} loses ${n} life`); draw(1); } else log(`${name}: fewer than two creatures are attacking you`); commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24PPre3(s, l, ctx)) return; return ds(s0, ctx); }; }

/* =================== more damage modifiers =================== */
STATIC_RULES.push(
  [/^if a source you control would deal noncombat damage to an opponent, it deals that much damage plus (\d+) instead$/, m => ({kind:'p24plus', who:'you', n:+m[1], oppOnly:true, playerOnly:true, nonCmb:true})],
  [/^if a red source you control would deal an amount of noncombat damage less than ~'s power to an opponent, that source deals damage equal to ~'s power instead$/, m => ({kind:'p24ojer', who:'you'})],
  [/^(?:delirium — )?if a source you control would deal noncombat damage to a permanent or player while there are four or more card types among cards in your graveyard, it deals double that damage instead$/, m => ({kind:'p24deliX2', who:'you'})],
  [/^if a source an opponent controls would deal damage to you or a permanent you control, prevent 1 of that damage$/, m => ({kind:'p24prev1', who:'you'})],
  [/^enchanted creature's controller may have it assign its combat damage as though it weren't blocked$/, m => ({kind:'p24unbA', who:'all'})],
  [/^for each (non-human creature|creature with no abilities) you control, you may have that creature assign its combat damage as though it weren't blocked$/, m => ({kind:'p24unb', who:'you', d:m[1]})],
  [/^for each creature you control with no abilities, you may have that creature assign its combat damage as though it weren't blocked$/, m => ({kind:'p24unb', who:'you', d:'creature with no abilities'})],
);
function p24GyTypes(){ const s = new Set(); S.gy.forEach(c => (info(c.k)?.t || '').split('—')[0].split(/\s+/).forEach(w => { if (/^(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)$/.test(w)) s.add(w); })); return s.size; }
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){
    try { if (S && n > 0 && t){ const T = p24T(); const cmb = !!(UI.r23cmb || UI.h23combat); const opp = !!(t.pid && t.pid !== MYPID);
      // Moonmist: combat damage by creatures other than Werewolves and Wolves is prevented
      if (cmb && srcCard && isCreatureCard(srcCard) && [S, ...OPP.values()].some(st => st && st.p24moon === T) && !/\b(Werewolf|Wolf)\b/.test(typeOf(srcCard)) && !(extra && extra.p24np) && S.p24np !== T){ log(`combat damage from ${cname(srcCard)} prevented (Moonmist)`); return; }
      const jx = srcCard && srcCard.p24jeska; if (jx && cmb && t.t === 'player' && t.pid !== jx.by){ const [tn, ap] = currentTurn(); if (ap === jx.by && tn > jx.n) delete srcCard.p24jeska; else { log(`${cname(srcCard)} deals triple damage (${n} → ${n * 3})`); n *= 3; } }
      if (S.p24x2 === T){ log(`damage doubled (${n} → ${n * 2})`); n *= 2; }
      if (!cmb && rulesOn('p24deliX2').length && p24GyTypes() >= 4){ log(`delirium: damage doubled (${n} → ${n * 2})`); n *= 2; }
      if (!cmb && opp && t.t === 'player'){ for (const r of rulesOn('p24ojer')){ const c = S.bf.find(b => b.k && !b.fd && info(b.k)?.n === r.src); const col = (srcCard && srcCard.k ? info(srcCard.k)?.c : info(srcK)?.c) || ''; const p = c ? (stats(c) || [0])[0] : 0; if (/R/.test(col) && n < p){ log(`${r.src}: deals ${p} damage instead of ${n}`); n = p; } } }
    } } catch (e){ console.warn(e); }
    return dd(t, n, srcK, srcCard, extra); };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (S && n > 0 && from && from !== MYPID && !(f && f.p24np)){ const k = rulesOn('p24prev1').length; if (k){ log(`prevented ${Math.min(n, k)} of that damage`); n -= k; if (n <= 0) return; } } } catch {} return dm(n, f, from); };
  const dc = damageCard;
  damageCard = function(c, n, f = {}){ try { const from = UI.p24from; if (S && c && n > 0 && S.bf.includes(c) && from && from !== MYPID && !(f && f.p24np)){ const k = rulesOn('p24prev1').length; if (k){ log(`prevented ${Math.min(n, k)} damage to ${cname(c)}`); n -= k; if (n <= 0) return 0; } } } catch {} return dc(c, n, f); };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S.p24moon === p24T()) o.p24moon = S.p24moon; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s.p24moon) o.p24moon = String(s.p24moon).slice(0, 20); } catch {} return o; };
  // "assign its combat damage as though it weren't blocked"
  const ad = attackerDamage;
  attackerDamage = async function(step, blocks, ...a){
    try { if (S && blocks && !UI.dry){ const key = turnStr() + ':' + (S.cb ? S.cb.n : 0); let bl = null;
      for (const c of S.bf.filter(x => x.atk && (blocks.get(x.id) || []).length)){
        let why = '';
        for (const b of boardsAll()) for (const s of b.bf){ if (s.att && s.att.id === c.id && (s.att.pid || b.pid) === MYPID && s.k && !s.fd && /^enchanted creature's controller may have it assign its combat damage as though it weren't blocked\.?$/m.test(p24Txt(s))) why = info(s.k).n; }
        for (const r of rulesOn('p24unb')){ if (r.d === 'non-human creature' && !/\bHuman\b/.test(typeOf(c))) why = r.src; if (r.d === 'creature with no abilities' && !String(info(c.k)?.o || '').trim() && !(c.ekw || []).length) why = r.src; }
        if (/^you may have ~ assign its combat damage as though it weren't blocked\.?$/m.test(p24Txt(c))) why = cname(c);
        if (!why) continue;
        if (c.p24unb == null || c.p24unbK !== key){ c.p24unbK = key; c.p24unb = await askYes(`${cname(c)} is blocked — assign its combat damage as though it weren't blocked (${why})?`, 'Hit the defender', 'Damage the blockers'); }
        if (c.p24unb){ bl = bl || new Map(blocks); bl.delete(c.id); log(`${cname(c)} assigns its combat damage as though it weren't blocked`); }
      }
      if (bl) blocks = bl; } } catch (e){ console.warn(e); }
    return ad.call(this, step, blocks, ...a); };
}
/* =================== extra beginning phases / upkeep steps =================== */
{
  const sp = setPhase;
  setPhase = function(i, ...a){
    try { if (S && !UI.dry && currentTurn()[1] === MYPID){ const cur = (S.ph || [])[2];
      if (i === 2 && cur === 1 && S.p24xUp > 0){ S.p24xUp--; log('additional upkeep step'); S.seenPh = ''; return sp(1, ...a); }
      if ((i === 6 || i === 7) && cur === 5 && S.p24xBeg > 0){ S.p24xBeg--; S.p24ret = i; log('additional beginning phase (untap, upkeep, draw)'); const sk = S.bf.map(c => [c, c.sk]); const r = sp(0, ...a); sk.forEach(([c, v]) => { if (S.bf.includes(c)) c.sk = v; }); commit(); return r; }
      if (i === 3 && S.p24ret != null && cur === 2){ const to = S.p24ret; S.p24ret = null; return sp(to, ...a); }
    } } catch (e){ console.warn(e); }
    return sp(i, ...a); };
  const tc = turnChanged;
  turnChanged = function(...a){ try { if (S){ S.p24xBeg = 0; S.p24xUp = 0; S.p24ret = null; } } catch {} return tc.apply(this, a); };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (w === 'at'){
      if (/^the beginning of enchanted player's first upkeep each turn$/.test(c)) return {ev:'step', step:'upkeep', whose:'each', p24ench:true, p24first:true};
      if (/^the beginning of each of enchanted player's postcombat main phases$/.test(c)) return {ev:'step', step:'main2', whose:'each', p24ench:true};
    }
    return ct(w, c); };
  const pt = pushTrigger;
  pushTrigger = function(src, t, ev, evPid){
    try { if (t && t.p24ench){ const a = S.bf.find(b => b.id === src.id); if (!(a && a.att && a.att.id == null && a.att.pid === evPid)) return;
      if (t.p24first){ const key = turnStr(); a.p24first = a.p24first || {}; if (a.p24first[t.raw] === key) return; a.p24first[t.raw] = key; } } } catch {}
    return pt(src, t, ev, evPid); };
  const ao = applyOp;
  applyOp = function(r, from){ if (r && r.op === 'p24xbeg'){ S.p24xBeg = (S.p24xBeg || 0) + 1; log(`gets an additional beginning phase after this phase (${r.src})`); commit(); return; }
    if (r && r.op === 'p24jeska'){ const c = S.bf.find(b => b.id === r.tid); if (c){ c.p24jeska = {by:from, n:r.n}; log(`${cname(c)}: deals triple combat damage to ${nameOf(from)}'s opponents until their next turn (${r.src})`); } commit(); return; }
    if (r && r.op === 'p24xup'){ S.p24xUp = (S.p24xUp || 0) + 1; log(`gets an additional upkeep step (${r.src})`); commit(); return; } return ao(r, from); };
}
RQ_OPS.push('p24xbeg', 'p24xup', 'p24jeska');
async function doRound24PPre4(s, l, ctx){
  let m; const name = ctx.name || ''; const T = p24T();
  const say = t => doSentence(cap(t), ctx);
  const tgt = () => (ctx.tgts ? nextTargets(ctx) : [])[0];
  const ench = () => { const a = srcCardOf(ctx); return a && a.att && a.att.id == null ? a.att.pid : null; };
  if (/^there is an additional beginning phase after this phase$/.test(l)){ const pid = /enchanted player/i.test(ctx.full || '') ? (ench() || (ctx.it && ctx.it.evPid)) : MYPID; if (UI.dry) return true;
    if (!pid || pid === MYPID){ S.p24xBeg = (S.p24xBeg || 0) + 1; log(`${name}: there is an additional beginning phase after this phase`); } else sendRq(pid, 'p24xbeg', 0, name); commit(); return true; }
  if (/^that player gets an additional upkeep step after this step$/.test(l)){ const pid = ench() || (ctx.it && ctx.it.evPid); if (UI.dry) return true; if (!pid || pid === MYPID){ S.p24xUp = (S.p24xUp || 0) + 1; log(`${name}: additional upkeep step after this one`); } else sendRq(pid, 'p24xup', 0, name); commit(); return true; }
  if ((m = l.match(/^(if you pay, )?untap all creatures you control,? and after this phase, there is an additional combat phase$/))){ if (m[1] && ctx.didPay === false){ log(`${name}: didn't pay`); return true; } await say('Untap all creatures you control'); await say('After this phase, there is an additional combat phase'); return true; }
  if (/^prevent all combat damage that would be dealt this turn by creatures other than werewolves and wolves$/.test(l)){ S.p24moon = T; log(`${name}: combat damage by creatures other than Werewolves and Wolves is prevented this turn`); commit(); return true; }
  if (/^if a source you control would deal damage this turn, it deals double that damage instead$/.test(l)){ S.p24x2 = T; log(`${name}: your sources deal double damage this turn`); commit(); return true; }
  if (/^until your next turn[,:] if that creature would deal combat damage to one of your opponents, it deals triple that damage to that player instead$/.test(l)){
    const t = (ctx.lastT || [])[0] || tgt(); if (t && !UI.dry){ if (t.pid === MYPID){ const c = S.bf.find(b => b.id === t.id); if (c) c.p24jeska = {by:MYPID, n:currentTurn()[0]}; } else sendRq(t.pid, 'p24jeska', currentTurn()[0], name, {tid:t.id}); log(`${name}: until your next turn, that creature deals triple combat damage to your opponents`); } commit(); return true; }
  // excess-damage triggers
  if ((m = l.match(/^amass (\w+) x, where x is that excess damage$/))){ const n = (ctx.it && ctx.it.evN) || 0; if (n > 0) await say(`Amass ${m[1]} ${n}`); return true; }
  if ((m = l.match(/^(.+?) deals damage equal to the excess to any target other than that permanent$/))){ const n = (ctx.it && ctx.it.evN) || 0; const t = tgt(); const c = srcCardOf(ctx); if (t && n > 0 && !(t.id != null && t.id === (ctx.it && ctx.it.evId) && t.pid === (ctx.it && ctx.it.evPid))){ dealDamage(t, n, ctx.k, c); log(`${name} deals ${n} damage`); } commit(); return true; }
  // Fiendlash: the equipped creature that was dealt damage deals damage equal to its power
  if ((m = l.match(/^it deals damage equal to its power to (target player or planeswalker|any target)$/)) && ctx.it && ctx.it.evId != null){
    const c = S.bf.find(b => b.id === ctx.it.evId); const a = srcCardOf(ctx); if (!c || !a || !a.att || a.att.id !== c.id) return false;
    const t = tgt(); const p = Math.max(0, (stats(c) || [0])[0]); if (t && p){ dealDamage(t, p, c.k, c); log(`${cname(c)} deals ${p} damage`); } commit(); return true; }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound24PPre4(s, l, ctx)) return; return ds(s0, ctx); }; }
// Toralf: creature or planeswalker
{
  const ct = classifyTrig;
  classifyTrig = function(w, c){ let m; if ((m = c.match(/^a creature or planeswalker an opponent controls is dealt excess (noncombat )?damage$/))) return {ev:'p24exc', subj:'any', ctl:'opp', desc:'', p24non:!!m[1]}; return ct(w, c); };
}
// Bloatfly Swarm
{
  const dc = damageCard;
  damageCard = function(c, n, f = {}){ try { if (S && c && n > 0 && S.bf.includes(c) && (c.cp || 0) > 0 && !(f && f.p24np) && /^if damage would be dealt to ~ while it has a \+1\/\+1 counter on it, prevent that damage, remove that many \+1\/\+1 counters from it, then give each player a rad counter for each \+1\/\+1 counter removed this way\.?$/m.test(p24Txt(c))){
      const k = Math.min(n, c.cp); c.cp -= k; log(`${cname(c)}: ${n} damage prevented, removed ${k} +1/+1 counter${k === 1 ? '' : 's'} — each player gets ${k} rad counter${k === 1 ? '' : 's'}`);
      if (!UI.dry && k){ addPC('rad', k); opponents().forEach(p => sendRq(p.pid, 'rad', k, cname(c))); } return 0; } } catch (e){ console.warn(e); } return dc(c, n, f); };
}
STATIC_RULES.push([/^if damage would be dealt to ~ while it has a \+1\/\+1 counter on it, prevent that damage, remove that many \+1\/\+1 counters from it, then give each player a rad counter for each \+1\/\+1 counter removed this way$/, m => ({kind:'noop'})]);
