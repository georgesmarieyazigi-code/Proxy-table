/* ===================== Rules engine — round 23 helper F: gaps among ranks 0–2264 of the 7,000 most-played cards ===================== */
RQ_OPS.push('r23fWarp', 'r23fSearch', 'r23fPhase', 'r23fFlag', 'r23fMaySac', 'r23fTorment', 'r23fKeep', 'r23fTempt');
const R23F = { ans:{} };
const r23fTgt = ctx => (ctx && ctx.tgts ? nextTargets(ctx) : [])[0];
const r23fPow = c => { const st = c && stats(c); return st ? Math.max(0, st[0]) : 0; };

/* ---------- Counting: phrases the engine used to ask about ---------- */
function r23fCount(p, ctx){
  let m; p = String(p || '').toLowerCase().trim().replace(/\.$/, '');
  const mine = S.bf.filter(b => !b.fd && isCreatureCard(b));
  if ((m = p.match(/^the greatest (power|toughness) among (other )?(non-?([a-z]+) |([a-z]+) )?creatures you control$/))){
    const sc = ctx ? srcCardOf(ctx) : null; const i = m[1] === 'power' ? 0 : 1;
    const list = mine.filter(b => !(m[2] && b === sc) && (!m[4] || !new RegExp('\\b' + m[4] + '\\b', 'i').test(typeOf(b))) && (!m[5] || new RegExp('\\b' + m[5] + '\\b', 'i').test(typeOf(b))));
    return Math.max(0, ...list.map(b => (stats(b) || [0, 0])[i]));
  }
  if ((m = p.match(/^(?:~'s|its) (power|toughness)$/))){
    const c = ctx ? srcCardOf(ctx) : null; const i = m[1] === 'power' ? 0 : 1;
    if (c && S.bf.includes(c)) return Math.max(0, (stats(c) || [0, 0])[i]);
    const l = ctx && ctx.srcId != null && typeof r21aLki === 'function' ? r21aLki(ctx.srcId) : null; const k = (l && l.k) || (c && c.k) || (ctx && ctx.k);
    if (!k) return null; const base = parseInt(i ? info(k)?.t : info(k)?.p) || 0; return Math.max(0, base + ((l && l.cp) || 0) - ((l && l.cm) || 0));
  }
  if ((m = p.match(/^the sacrificed creature's (power|toughness)$/))){ const c = ctx && ctx.sacd; if (!c) return 0; const base = parseInt(m[1] === 'power' ? info(c.k)?.p : info(c.k)?.t) || 0; return Math.max(0, base + (c.cp || 0) - (c.cm || 0)); }
  if ((m = p.match(/^(?:the number of )?cards in your hand plus (one|two|three|\d+)$/))) return S.hand.length + (wn(m[1]) || 1);
  if ((m = p.match(/^the sacrificed (?:creature|permanent|artifact)'s mana value$/))) return ctx && ctx.sacd ? (info(ctx.sacd.k)?.mv || 0) : 0;
  if ((m = p.match(/^(one|two|three|four|\d+) plus (.+)$/))){ const r = countOf(m[2], ctx); return r == null ? null : (wn(m[1]) || +m[1] || 0) + r; }
  if ((m = p.match(/^(?:the number of )?creatures? that died this turn$/))) return typeof r19Died === 'function' ? r19Died() : 0;
  if ((m = p.match(/^(?:the number of )?(artifacts?|creatures?|lands?|enchantments?) (?:target player|that player|target opponent) controls$/))){
    const t = (ctx && ctx.lastT && ctx.lastT[0] && ctx.lastT[0].t === 'player' ? ctx.lastT[0] : null) || r23fTgt(ctx); const pid = t && t.pid || (ctx && ctx.it && (ctx.it.evDp || ctx.it.evPid));
    if (t && ctx) ctx.lastT = [t];
    const d = sing(m[1]); const bf = !pid || pid === MYPID ? S.bf : (OPP.get(pid)?.bf || []);
    return bf.filter(b => b.k && !b.fd && descOk(b.k, d, {tok:b.tok})).reduce((a, b) => a + (b.n || 1), 0);
  }
  if (/^the result$/.test(p) && ctx && ctx.roll != null) return ctx.roll;
  return null;
}
{
  const co = countOf;
  countOf = function(phrase, ctx){ try { const n = r23fCount(phrase, ctx); if (n != null) return n; } catch (e){ console.warn('r23f count', e); } return co(phrase, ctx); };
}
// "a land card with a basic land type"
{
  const dk = descOk;
  descOk = function(k, desc, o = {}){
    const d = String(desc || '');
    if (/\bwith a basic land type\b/i.test(d)){ const t = ((o.face || info(k) || {}).t || ''); if (!/\b(Plains|Island|Swamp|Mountain|Forest)\b/.test(t)) return false; return dk(k, d.replace(/\s*with a basic land type\b/i, ''), o); }
    return dk(k, desc, o);
  };
}

/* ---------- Mana: auto-pay taps get the same extras as a manual tap ---------- */
function r23fTide(c){
  // High Tide / Bubbling Muck from any player this turn
  const out = []; const T = turnStr();
  const all = [S.r23tide || []].concat([...OPP.values()].map(s => s.r23tide || []));
  for (const list of all) for (const x of list) if (x.t === T && new RegExp('\\b' + x.ty + '\\b').test(typeOf(c))) out.push(x.col);
  return out;
}
function r23fTapExtras(c, ab, outs, auto){
  const extra = []; if (!c || !outs) return extra;
  const tapped = /\{T\}/i.test((ab && ab.cost) || '{T}');
  if (auto){
    const k = tapped && typeof r21mult === 'function' ? r21mult(c) : 1;
    for (let i = 1; i < k; i++) extra.push(...outs);
    const got = outs.slice(); for (let i = 1; i < k; i++) got.push(...outs);
    if (isLand(c.k)){
      for (const b of S.bf){ if (!b.att || b.att.id !== c.id || b.att.pid !== MYPID) continue; const o = tname(info(b.k)?.o || '', info(b.k)?.n); const mm = o.match(/^whenever enchanted (?:land|forest) is tapped for mana, its controller adds an additional (\{[wubrgc]\}|one mana of the chosen color|one mana of any color)/im); if (mm) extra.push(/^\{/.test(mm[1]) ? mm[1][1].toUpperCase() : (b.col || outs[0] || 'G')); }
      for (const b of S.bf){ const o = tname(info(b.k)?.o || '', info(b.k)?.n); const mm = o.match(/^whenever you tap an? (swamp|island|forest|mountain|plains) for mana, add an additional (\{[wubrgc]\})/im); if (mm && new RegExp('\\b' + mm[1] + '\\b', 'i').test(typeOf(c))) extra.push(mm[2][1].toUpperCase()); }
    }
    for (const b of S.bf){ if (b.fd) continue; const o = typeof r21textOf === 'function' ? r21textOf(b) : ''; let m;
      if (isLand(c.k) && b.col && /^whenever a land's ability causes you to add one or more mana of the chosen colou?r, add an additional one mana of that colou?r\.?$/im.test(o) && got.includes(b.col)) extra.push(b.col);
      if (isLand(c.k) && b.col && /^whenever a basic land is tapped for mana of the chosen colou?r, its controller adds an additional one mana of that colou?r\.?$/im.test(o) && tapped && /\bBasic\b/.test(info(c.k)?.t || '') && got.includes(b.col)) extra.push(b.col);
      if (tapped && (m = o.match(/^whenever you tap an? (creature|artifact|nonland permanent|land|permanent) for mana, add an additional (\{[wubrgc]\})\.?$/im))){
        const ok = m[1] === 'creature' ? isCreatureCard(c) : m[1] === 'artifact' ? /Artifact/.test(typeOf(c)) : m[1] === 'land' ? isLand(c.k) : m[1] === 'nonland permanent' ? !isLand(c.k) : true;
        if (ok) extra.push(m[2][1].toUpperCase()); }
    }
  }
  // not handled by the manual-tap code either: Forsaken Monument, High Tide
  if (tapped && outs.includes('C')) for (const b of S.bf){ if (!b.fd && /^whenever you tap a permanent for \{c\}, add an additional \{c\}\.?$/im.test(tname(info(b.k)?.o || '', info(b.k)?.n))) extra.push('C'); }
  if (isLand(c.k)) extra.push(...r23fTide(c));
  return extra;
}
// the auto-pay planner sees the extra mana each source will really make, and tapping adds exactly that
{
  const as = autoSources;
  autoSources = function(){ const out = as();
    try { for (const src of out) src.opts = src.opts.map(o => { const ex = r23fTapExtras(src.c, o.ab, o.outs, true); return ex.length ? {...o, outs:o.outs.concat(ex), r23ex:ex} : o; }); } catch (e){ console.warn(e); }
    return out; };
}
{
  const am = activateMana;
  activateMana = async function(c, ab, ch){
    const before = S ? {...S.pool} : null; const wasTap = c && c.tap;
    const r = await am(c, ab, ch);
    try { if (S && c && before && !UI.dry && c.tap && !wasTap){ const got = []; for (const k of Object.keys(S.pool)) for (let i = before[k] || 0; i < (S.pool[k] || 0); i++) got.push(k);
      const ex = r23fTapExtras(c, ab, got, false); if (ex.length){ addMana(ex); log(`${cname(c)}: +${ex.map(x => '{' + x + '}').join('')} extra`); commit(); } } } catch (e){ console.warn(e); }
    return r;
  };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S && S.r23tide){ const T = turnStr(); const l = S.r23tide.filter(x => x.t === T); if (l.length) o.r23tide = l.slice(0, 6); } } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s && Array.isArray(s.r23tide)) o.r23tide = s.r23tide.slice(0, 6).map(x => ({t:String(x.t).slice(0, 20), ty:String(x.ty).replace(/[^A-Za-z]/g, '').slice(0, 12), col:String(x.col).replace(/[^WUBRGC]/g, '').slice(0, 1)})); } catch {} return o; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^a land's ability causes you to add one or more mana of the chosen colou?r$/.test(c) || /^you tap an? (?:creature|artifact|nonland permanent|permanent) for (?:mana|\{c\})$/.test(c) || /^a basic land is tapped for mana of the chosen colou?r$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'you', desc:''};
    if (/^you tap ~ for mana$/.test(c)) return {ev:'manatap', subj:'self', ctl:'you', desc:'', r23self:true};
    return ct(w, c);
  };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (t && t.r23self && ev && ev.type === 'manatap') return pid === MYPID && ev.id === src.id; return sm(t, src, ev, pid); };
}
STATIC_KNOWN.push(/^if you tap an? (?:permanent|land|basic land|creature|artifact) for mana, it produces (?:twice|three times) as much of that mana instead$/);
// granted mana abilities: Jaheira, Rishkar, Night of the Sweets' Revenge, The World Tree
STATIC_RULES.push(
  [/^(tokens|foods|creatures|artifacts|elves|treasures) you control have "\{t\}: add (\{[wubrgc]\}|one mana of any color)"?$/, m => ({kind:'r23fMana', who:'you', desc:sing(m[1].replace(/^elves$/, 'elf')), eff:m[2]})],
  [/^each creature you control with a counter on it has "\{t\}: add (\{[wubrgc]\})"?$/, m => ({kind:'r23fMana', who:'you', desc:'creature', ctr:true, eff:m[1]})],
  [/^as long as you control six or more lands, lands you control have "\{t\}: add one mana of any color"?$/, m => ({kind:'r23fMana', who:'you', desc:'land', lands6:true, eff:'one mana of any color'})],
);
{
  const ma = manaAbs;
  manaAbs = function(c){ let out = ma(c); if (!S || !c || !S.bf.includes(c) || out.some(o => o.r23f)) return out;
    for (const r of rulesOn('r23fMana')){
      if (!descOk(c.k, r.desc, {tok:c.tok})) continue;
      if (r.desc === 'token' && !c.tok) continue;
      if (r.ctr && !(c.cp || c.cm || (c.nc && Object.values(c.nc).some(v => v > 0)))) continue;
      if (r.lands6 && S.bf.filter(b => !b.fd && isLand(b.k)).reduce((a, b) => a + (b.n || 1), 0) < 6) continue;
      const eff = /^\{/.test(r.eff) ? `Add ${r.eff.toUpperCase()}` : 'Add one mana of any color';
      if (out.some(o => o.tapOnly && o.eff === eff)) continue;
      out = out.concat({cost:'{T}', eff, rest:'', outs:manaOuts(eff), tapOnly:true, line:`{T}: ${eff}. (${r.src})`, r23f:true});
    }
    return out; };
}

/* ---------- Effects ---------- */
async function doRound23FPre(s, l, ctx){
  let m; const tgt = () => r23fTgt(ctx); const src = () => srcCardOf(ctx);
  const full = tname(String(ctx.full || ''), ctx.name || '').toLowerCase();
  const otext = ctx.k ? tname(info(ctx.k)?.o || '', info(ctx.k)?.n || ctx.name || '').toLowerCase() : '';
  // ---- counting that used to ask
  if ((m = l.match(/^(?:you )?draw cards equal to (.+)$/))){ let n = countOf(m[1], ctx); if (n == null) return false; n = Math.max(0, n | 0); if (n) draw(n); log(`${ctx.name}: drew ${n} card${n === 1 ? '' : 's'}`); commit(); return true; }
  // ---- mana add-ons done when the land is tapped (manual tap: engine12/21c; auto-pay: autoTapNow above)
  if (/^its controller adds an additional (?:\{[wubrgc]\}|one mana of (?:the chosen colou?r|any colou?r))$/.test(l)) return true;
  if (/^add an additional (?:\{[wubrgc]\}|one mana of (?:that|the chosen) colou?r)$/.test(l) && ctx.it && ctx.it.kind !== 'spell') return true;
  if ((m = l.match(/^until end of turn, whenever a player taps an? (island|swamp|forest|mountain|plains) for mana, (?:target player|that player) adds an additional (\{[wubrg]\})$/))){
    S.r23tide = (S.r23tide || []).filter(x => x.t === turnStr()).concat({t:turnStr(), ty:cap(m[1]), col:m[2][1].toUpperCase()});
    log(`${ctx.name}: until end of turn, each ${cap(m[1])} tapped for mana adds an additional ${m[2].toUpperCase()}`); commit(); return true; }
  // ---- Chaos Warp (the owner does all three steps on their own client)
  if ((m = l.match(/^the owner of target permanent shuffles it into their library(?:, then reveals the top card of their library)?$/))){
    const t = tgt(); ctx.r23warp = 1; if (!t) return true;
    if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (c) r23fWarp(single(c), ctx.name); }
    else { sendRq(t.pid, 'r23fWarp', 0, ctx.name, {tid:t.id}); log(`${ctx.name}: ${nameOf(t.pid)} shuffles ${t.nm || 'a permanent'} into their library and reveals the top card`); }
    commit(); return true; }
  if (ctx.r23warp && (/^(?:then )?reveals the top card of their library$/.test(l) || /^if it's a permanent card, they put it onto the battlefield$/.test(l))) return true;
  // ---- target opponent creates a token (Forbidden Orchard)
  if ((m = l.match(/^(target opponent|target player) creates (an?|one|two|three|four|\d+) ([^.]+? tokens?)$/))){ const t = tgt(); if (t) await ctrlCreate(t, `${m[2]} ${m[3]}`, ctx); commit(); return true; }
  // ---- that player / target player may search for a land with a basic land type (Boseiju)
  if ((m = l.match(/^(?:that player|target player|its controller) may search their library for an? (land card with a basic land type|basic land card), put it onto the battlefield(?: tapped)?(?:, then shuffle)?$/))){
    const t = (ctx.lastT || [])[0] || tgt(); const pid = t && t.pid; const tapped = / tapped/.test(l) ? 1 : 0;
    if (!pid) return true;
    if (pid === MYPID){ if (UI.dry || await askYes(`${ctx.name}: search your library for a ${m[1]}?`, 'Search', 'No')) await searchLibrary(`a ${m[1]}`, `put it onto the battlefield${tapped ? ' tapped' : ''}, then shuffle`, ctx); }
    else { sendRq(pid, 'r23fSearch', tapped, ctx.name, {d:m[1]}); log(`${nameOf(pid)} may search for a ${m[1]} (${ctx.name})`); }
    commit(); return true; }
  // ---- create a number of … equal to … (Krenko, Goldvein Hydra, Ancient Gold Dragon)
  if ((m = l.match(/^(?:you )?create a number of (.+? tokens?(?: with [a-z ,]+?)?) equal to (.+)$/)) && !/["“]/.test(l)){
    let n = countOf(m[2], ctx); if (n == null) return false; n = Math.max(0, Math.min(n | 0, 60));
    if (!n){ log(`${ctx.name}: no tokens (0)`); return true; }
    const tt = s.slice(s.toLowerCase().indexOf(m[1]), s.toLowerCase().indexOf(m[1]) + m[1].length);
    await createFromText(`Create ${n} ${tt.replace(/\btokens?\b/, n === 1 ? 'token' : 'tokens')}`, ctx); commit(); return true; }
  // ---- Urza's Saga and other "~ gains "{cost}: effect."" abilities
  if ((m = s.match(/^(?:~|this saga|this land|this artifact) gains "([^"]+)"$/i)) && /^(?:\{[^}]+\}(?:, )?)+(?:, \{t\})?: /i.test(m[1].replace(/'/g, '"'))){
    const c = src(); if (c){ c.r23gab = [...new Set([...(c.r23gab || []), m[1].replace(/'/g, '"').replace(/\.?$/, '.')])]; log(`${cname(c)} gains "${m[1]}"`); commit(); } return true; }
  // ---- Animate Dead / Necromancy / Dance of the Dead
  if (/^if it's on the battlefield, it (?:loses "enchant creature card in a graveyard" and gains|becomes an aura with) "enchant creature put onto the battlefield with ~\.?"(?:\.)? (?:return enchanted creature card|put target creature card from a graveyard) (?:to|onto) the battlefield under your control and attach ~ to it$/.test(l) ||
      /^(?:return enchanted creature card|put target creature card from a graveyard) (?:to|onto) the battlefield under your control and attach ~ to it$/.test(l)){
    await r23fAnimate(ctx); return true; }
  if (/^if it's on the battlefield, it (?:loses "enchant creature card in a graveyard" and gains|becomes an aura with) "enchant creature put onto the battlefield with ~\.?"$/.test(l)) return true;
  if (/^when ~ leaves the battlefield, that creature's controller sacrifices it$/.test(l)) return true;   // done by the leave hook (r23fAnimLeave)
  // ---- Rise of the Dark Realms
  if (/^put all creature cards from all graveyards onto the battlefield under your control$/.test(l)){
    const mine = S.gy.filter(c => isCreatureCard(c)); mine.forEach(c => moveCard(c.id, 'bf', {quiet:true}));
    let n = mine.length; for (const p of opponents()){ const g = (OPP.get(p.pid)?.gy || []).filter(k => k && isCreatureCard({k})); g.forEach(k => sendRq(p.pid, 'gytake', 0, ctx.name, {d:k})); n += g.length; }
    log(`${ctx.name}: put ${n} creature card${n === 1 ? '' : 's'} from all graveyards onto the battlefield`); commit(); return true; }
  // ---- Living Death
  if (/^each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield$/.test(l) || (/^each player exiles all creature cards from their graveyard$/.test(l) && /then sacrifices all creatures they control, then puts all cards they exiled this way/.test(full))){
    r23fLivingDeath(ctx.name); opponents().forEach(p => sendRq(p.pid, 'r23fFlag', 0, ctx.name, {d:'livingDeath'})); ctx.r23ld = 1; commit(); return true; }
  if (ctx.r23ld && (/^(?:then )?sacrifices all creatures they control$/.test(l) || /^(?:then )?puts all cards they exiled this way onto the battlefield$/.test(l))) return true;
  // ---- each player sacrifices N creatures (Blasphemous Edict)
  if ((m = l.match(/^each player sacrifices (thirteen|seven|five|four|three|two|\d+) creatures(?: of their choice)?$/))){
    const n = ({thirteen:13, seven:7, five:5, four:4, three:3, two:2})[m[1]] || +m[1] || 1; addChoicePrompt('sac', 'creature', n, MYPID, ctx.name); opponents().forEach(p => sendRq(p.pid, 'sac', n, ctx.name, {d:'creature'}));
    log(`${ctx.name}: each player sacrifices ${n} creatures`); commit(); return true; }
  // ---- Veil of Summer
  if ((m = l.match(/^draw a card if an opponent has cast an? (white|blue|black|red|green)(?: or (white|blue|black|red|green))? spell this turn$/))){
    const want = [m[1], m[2]].filter(Boolean).map(x => ({white:'W', blue:'U', black:'B', red:'R', green:'G'})[x]); const T = turnStr();
    const ok = opponents().some(p => { const o = OPP.get(p.pid); return o && o.r23cc && o.r23cc.t === T && want.some(x => String(o.r23cc.c).includes(x)); });
    if (ok){ draw(1); log(`${ctx.name}: an opponent cast a ${m[1]}${m[2] ? ' or ' + m[2] : ''} spell this turn — drew a card`); } else log(`${ctx.name}: no opponent cast a ${m[1]}${m[2] ? ' or ' + m[2] : ''} spell this turn`);
    commit(); return true; }
  if (/^spells you control can't be countered this turn$/.test(l)){ S.r23uc = turnStr(); log(`${ctx.name}: their spells can't be countered this turn`); commit(); return true; }
  if ((m = l.match(/^you and permanents you control gain hexproof from (white|blue|black|red|green) and from (white|blue|black|red|green) until end of turn$/))){
    S.r23hx = {t:turnStr(), c:[m[1], m[2]].map(x => ({white:'W', blue:'U', black:'B', red:'R', green:'G'})[x]).join('')}; log(`${ctx.name}: they and their permanents gain hexproof from ${m[1]} and from ${m[2]} until end of turn`); commit(); return true; }
  // ---- "for each permanent destroyed this way" (Culling Ritual, Bane of Progress, Terastodon)
  if ((m = l.match(/^destroy (?:each|all) (.+?)$/)) && /for each permanent destroyed this way|for each permanent put into a graveyard this way/.test(full) && !ctx.r23cnt){
    let n = 0; const d = m[1].replace(/ with mana value (\d+) or less$/, ''); const mv = (m[1].match(/with mana value (\d+) or less$/) || [])[1];
    for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || isCreatureCard(c) && false) continue; const ds = d.replace(/s\b/g, '').replace(/\band\b/g, 'or'); if (!descOk(c.k, sing(d).replace(/ and /g, ' or '), {tok:c.tok})) continue; if (mv != null && (info(c.k)?.mv || 0) > +mv) continue; if (kwOf(c, 'indestructible', b.pid)) continue; n += (c.n || 1); }
    ctx.r23cnt = n; return false; }
  if ((m = l.match(/^add \{([wubrg])\} or \{([wubrg])\} for each permanent destroyed this way$/))){
    const n = ctx.r23cnt || 0; if (!n){ log(`${ctx.name}: nothing was destroyed — no mana`); return true; }
    const A = m[1].toUpperCase(), B = m[2].toUpperCase(); let k = n;
    if (!UI.dry) k = n <= 10 ? await askChoice({title:`${ctx.name}: add ${n} mana — how much {${A}}? (the rest is {${B}})`, options:Array.from({length:n + 1}, (_, i) => ({label:`${i} {${A}} + ${n - i} {${B}}`, html:manaHTML(`{${A}}`.repeat(i) + `{${B}}`.repeat(n - i)) || '—', value:i})).reverse()}) : await askNumber(`${ctx.name}: how many of the ${n} mana are {${A}}? (the rest is {${B}})`, '', n);
    k = Math.max(0, Math.min(n, +k || 0)); addMana([...Array(k).fill(A), ...Array(n - k).fill(B)]); log(`${ctx.name}: added ${'{' + A + '}'.repeat(1)}×${k} {${B}}×${n - k}`); commit(); return true; }
  if ((m = l.match(/^put a \+1\/\+1 counter on ~ for each permanent destroyed this way$/))){ const c = src(); const n = ctx.r23cnt || 0; if (c && n) modCounters(c, 'cp', n); log(`${ctx.name}: ${n} +1/+1 counters`); commit(); return true; }
  // ---- Terastodon
  if ((m = l.match(/^for each permanent put into a graveyard this way, its controller creates (an? [^.]+? token)$/))){
    for (const t of (ctx.lastT || []).filter(t => t.t === 'card')){ const c = boardOf(t.pid).find(b => b.id === t.id); if (c && kwOf(c, 'indestructible', t.pid)) continue; await ctrlCreate(t, m[1], ctx); }
    commit(); return true; }
  // ---- Syr Konrad: the rest of the trigger condition (the other two events are added in trigsOf below)
  if (/^or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, ~ deals 1 damage to each opponent$/.test(l)){
    const c = src(); opponents().forEach(p => dealDamage({t:'player', pid:p.pid}, 1, ctx.k, c)); commit(); return true; }
  // ---- Reality Shift: the exiled creature's controller manifests
  if (/^its controller manifests the top card of their library$/.test(l)){ const t = (ctx.lastT || [])[0]; if (!t) return true;
    if (t.pid === MYPID || !t.pid){ if (S.lib[0]) r21bManifest(S.lib[0], ctx.name); } else { sendRq(t.pid, 'r23fFlag', 0, ctx.name, {d:'manifest'}); log(`${nameOf(t.pid)} manifests the top card of their library (${ctx.name})`); }
    commit(); return true; }
  // ---- Braids, Arisen Nightmare
  if (/^if you do, each opponent may sacrifice a permanent of their choice that shares a card type with it$/.test(l) && /for each opponent who doesn't, that player loses (\d+) life and you draw a card/.test(full)){
    const sk = ctx.sacd && ctx.sacd.k; ctx.r23braids = []; if (!sk){ return true; }
    const types = (info(sk)?.t || '').split('—')[0].match(/\b(Artifact|Creature|Enchantment|Land|Planeswalker|Battle)\b/g) || [];
    const n = +(full.match(/that player loses (\d+) life/) || [])[1] || 2;
    for (const p of opponents()){
      if (UI.dry) continue;
      const ref = rid(6); sendRq(p.pid, 'r23fMaySac', 0, ctx.name, {ref, d:types.join(' ')}); commit();
      const a = await waitUntil(() => R22.ans[ref], 60000); const did = !!(a && a.idx[0] === 1);
      if (!did){ loseLife(p.pid, n, ctx.name); draw(1); log(`${ctx.name}: ${nameOf(p.pid)} didn't sacrifice — loses ${n} life, and they draw a card`); }
    }
    ctx.r23braidsDone = 1; commit(); return true; }
  if (ctx.r23braidsDone && /^for each opponent who doesn't, (?:that|target) player loses \d+ life(?: and you draw a card)?$|^you draw a card$/.test(l)) return true;
  if (/^for each opponent who doesn't, (?:that|target) player loses \d+ life and you draw a card$/.test(l) && /each opponent may sacrifice a permanent of their choice that shares a card type with it/.test(full)){ ctx.r23braidsDone = 1; return true; }
  // ---- Torment of Hailfire
  if (/^repeat the following process x times$/.test(l) && /each opponent loses 3 life unless that player sacrifices a nonland permanent of their choice or discards a card/.test(full)){
    const x = (ctx.it && ctx.it.x) || (UI.spellX && UI.spellX.x) || 0; ctx.r23torm = 1;
    if (x > 0) opponents().forEach(p => sendRq(p.pid, 'r23fTorment', Math.min(x, 99), ctx.name)); log(`${ctx.name}: each opponent chooses ${x} time${x === 1 ? '' : 's'}: lose 3 life, sacrifice a nonland permanent or discard a card`); commit(); return true; }
  if (ctx.r23torm && /^each opponent loses 3 life unless (?:that|target) player sacrifices a nonland permanent of their choice or discards a card$/.test(l)) return true;
  // ---- Plaguecrafter
  if (/^each player sacrifices an? (creature or planeswalker|creature) of their choice$/.test(l) && /each player who can't discards a card/.test(full)){
    const d = /planeswalker/.test(l) ? 'creature or planeswalker' : 'creature'; ctx.r23plague = 1; r23fPlague(d, ctx.name); opponents().forEach(p => sendRq(p.pid, 'r23fFlag', 0, ctx.name, {d:'plague:' + d})); commit(); return true; }
  if (ctx.r23plague && /^each player who can't discards a card$/.test(l)) return true;
  // ---- Midnight Clock / Timetwister-style
  if (/^shuffle your hand and graveyard into your library$/.test(l)){ const n = S.hand.length + S.gy.length; S.lib.push(...S.hand.splice(0), ...S.gy.splice(0)); shuffle(S.lib); log(`${ctx.name}: shuffled their hand and graveyard (${n} cards) into their library`); commit(); return true; }
  if (/^exile ~$/.test(l)){ const c = src(); if (c && S.bf.includes(c)) moveCard(c.id, 'ex'); commit(); return true; }
  // ---- Ripples of Undeath
  if ((m = l.match(/^(?:then )?you may pay \{(\d+)\} and (\d+) life$/)) && /put a card from among those cards into your hand/.test(full)){
    ctx.didPay = false; const cost = `{${m[1]}}`; const life = +m[2]; if (UI.dry){ ctx.didPay = true; return true; }
    const plan = payPlan(parseCost(cost), S.pool); if (plan.err || S.life < life){ log(`${ctx.name}: can't pay ${cost} and ${life} life`); return true; }
    if (!(await askYes(`${ctx.name}: pay ${cost} and ${life} life to put one of the milled cards into your hand?`, 'Pay', 'No'))) return true;
    S.pool = plan.pool; S.life -= life; ctx.didPay = true; log(`${ctx.name}: paid ${cost} and ${life} life → ${S.life}`); commit(); return true; }
  if (/^if you do, put a card from among those cards into your hand$/.test(l) && /mill (?:three|two|four|\d+) cards/.test(full)){
    if (!ctx.didPay) return true; const nn = wn((full.match(/mill (three|two|four|\d+) cards/) || [])[1]) || 3; const pool = (ctx.r23milled || S.gy.slice(-nn)).filter(c => S.gy.includes(c));
    if (!pool.length || UI.dry) return true; const ids = await pickCards({title:`${ctx.name}: put a card from among those cards into your hand`, cards:pool, min:1, max:1}); const c = (ids || [])[0] != null ? S.gy.find(x => x.id === ids[0]) : null; if (c){ moveCard(c.id, 'hand'); } commit(); return true; }
  // ---- phasing (up to one / any number of / X targets)
  if ((m = l.match(/^(?:up to (one|two|three|x) |any number of (?:other )?)target (creature|creatures|permanent|permanents|nonland permanents?|creatures you control|nonland permanents you control|other creatures you control|creature you don't control)s? phases? out$/)) ||
      (m = l.match(/^(?:up to (one|two|three|x) |any number of )?(?:other )?target (creatures? you don't control|creature you control|nonland permanents? you control) phases? out$/)) ||
      (m = l.match(/^any number of other target (creatures you control) phase out$/))){
    let t; while ((t = tgt())) r23fPhaseOut(t, ctx.name); commit(); return true; }
  // ---- creatures your opponents control attack this turn if able (Bident of Thassa)
  if (/^creatures your opponents control attack this turn if able$/.test(l)){ S.r23must = turnStr(); log(`${ctx.name}: creatures their opponents control attack this turn if able`); commit(); return true; }
  // ---- Kardur: goad every creature the opponents control until your next turn
  if (/^until your next turn: creatures your opponents control attack each combat if able and attack a player other than you if able$/.test(l) || /^until your next turn, creatures your opponents control attack each combat if able and attack a player other than you if able$/.test(l) || /^goad all creatures your opponents control$/.test(l)){
    for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) sendRq(pid, 'goad', 0, ctx.name, {tid:c.id}); }); log(`${ctx.name}: goaded every creature their opponents control`); commit(); return true; }
  // ---- An opponent gains control of ~ (Wishclaw Talisman, Humble Defector)
  if ((m = l.match(/^(an opponent|target opponent) gains control of ~$/))){
    const c = src(); if (!c || !S.bf.includes(c)) return true; let pid = null;
    if (/^target/.test(m[1])){ const t = tgt(); pid = t && t.pid; }
    if (!pid){ const ops = opponents(); if (!ops.length) return true; pid = ops.length === 1 || UI.dry ? ops[0].pid : await askChoice({title:`${ctx.name}: which opponent gains control of it?`, options:ops.map(p => ({label:nameOf(p.pid), value:p.pid}))}); }
    if (pid && pid !== MYPID && !UI.dry) giveAway(single(c), pid, {perm:true}); commit(); return true; }
  if (/^until your next turn(?::|,) those creatures can't block$/.test(l) && /goad all creatures your opponents control/.test(full)){ S.r23noBlk = {n:currentTurn()[0]}; log(`${ctx.name}: those creatures can't block until their next turn`); commit(); return true; }
  // ---- search with "where X is …" whose card goes onto the battlefield (Eldritch Evolution)
  if ((m = l.match(/^search your library for (an? [a-z ]+ card) with mana value x or less, where x is (.+)$/)) && /put that card onto the battlefield/.test(full)){
    const x = countOf(m[2], ctx); if (x == null) return false; ctx.r23srch = 1;
    await searchLibrary(`${m[1]} with mana value ${x} or less`, 'put it onto the battlefield, then shuffle', ctx); commit(); return true; }
  if (ctx.r23srch && (/^put that card onto the battlefield$/.test(l) || /^(?:then )?shuffle$/.test(l))) return true;
  // ---- Descent into Avernus (after the count was filled in)
  if ((m = l.match(/^(?:then )?each player creates (\d+) treasure tokens and ~ deals (\d+) damage to each player$/))){
    const n = +m[1], d = +m[2]; const c = src();
    if (n){ await createFromText(`Create ${n} Treasure token${n === 1 ? '' : 's'}`, ctx); opponents().forEach(p => sendRq(p.pid, 'tokText', 0, ctx.name, {d:`${n} Treasure token${n === 1 ? '' : 's'}`})); }
    if (d) players().forEach(p => dealDamage({t:'player', pid:p.pid}, d, ctx.k, c));
    commit(); return true; }
  // ---- Cut a Deal / Tempt with Bunnies
  if (/^you draw a card for each opponent who drew a card this way$/.test(l)){ const n = opponents().length; if (n) draw(n); log(`${ctx.name}: drew ${n}`); commit(); return true; }
  // ---- All Is Dust
  if (/^each player sacrifices all permanents they control that are one or more colors$/.test(l)){ r23fAllIsDust(ctx.name); opponents().forEach(p => sendRq(p.pid, 'r23fFlag', 0, ctx.name, {d:'allIsDust'})); commit(); return true; }
  // ---- exile any number of target creatures you control (flicker; the return sentence uses lastEx)
  if (/^exile any number of target creatures you control$/.test(l)){ let t; const ex = []; while ((t = tgt())){ const c = S.bf.find(b => b.id === t.id); if (c && !c.tok){ moveCard(c.id, 'ex'); ex.push(c.id); } else if (c) moveCard(c.id, 'ex'); }
    ctx.lastEx = (ctx.lastEx || []).concat(ex); commit(); return true; }
  // ---- Slip Out the Back
  if (/^it phases out$/.test(l)){ const t = (ctx.lastT || [])[0]; if (t) r23fPhaseOut(t, ctx.name); commit(); return true; }
  // ---- keep some, sacrifice the rest
  if (/^each opponent chooses a permanent they control of each permanent type and sacrifices the rest$/.test(l)){ opponents().forEach(p => sendRq(p.pid, 'r23fKeep', 0, ctx.name, {d:'types'})); log(`${ctx.name}: each opponent keeps one permanent of each type and sacrifices the rest`); commit(); return true; }
  if (/^each player puts a vow counter on a creature they control and sacrifices the rest$/.test(l)){ await r23fKeep('vow', ctx.name, MYPID); opponents().forEach(p => sendRq(p.pid, 'r23fKeep', 0, ctx.name, {d:'vow'})); ctx.r23vow = 1; commit(); return true; }
  if (/^each of those creatures can't attack you or planeswalkers you control for as long as it has a vow counter on it$/.test(l)) return true;   // enforced in declareAttackers (r23vow)
  if (/^each player chooses a creature or planeswalker they control, then sacrifices the rest$/.test(l)){ await r23fKeep('crpw', ctx.name, MYPID); opponents().forEach(p => sendRq(p.pid, 'r23fKeep', 0, ctx.name, {d:'crpw'})); commit(); return true; }
  if (/^players can't cast creature or planeswalker spells until the end of your next turn$/.test(l)){ S.r23noCr = {n:currentTurn()[0]}; log(`${ctx.name}: players can't cast creature or planeswalker spells until the end of ${nameOf(MYPID)}'s next turn`); commit(); return true; }
  if ((m = l.match(/^(that player|target player) chooses up to (one|two|three) creatures they control, then sacrifices the rest$/)) || (m = l.match(/^(that player|target player) chooses up to (one|two|three) creatures they control$/)) && /sacrifices the rest/.test(full)){
    const pid = /^target/.test(m[1]) ? (tgt() || {}).pid : (ctx.it && (ctx.it.evPid || ctx.it.evDp)); const n = wn(m[2]) || 2; ctx.r23keepDone = 1;
    if (!pid) return true; if (pid === MYPID) await r23fKeep('cr:' + n, ctx.name, MYPID); else sendRq(pid, 'r23fKeep', 0, ctx.name, {d:'cr:' + n}); commit(); return true; }
  if (ctx.r23keepDone && /^(?:then )?sacrifices the rest$/.test(l)) return true;
  // ---- Tempt with Discovery
  if (/^search your library for a land card and put it onto the battlefield$/.test(l) && /each opponent may search their library for a land card and put it onto the battlefield/.test(full)){
    await searchLibrary('a land card', 'put it onto the battlefield', ctx); let yes = 0;
    for (const p of opponents()){ if (UI.dry) continue; const ref = rid(6); sendRq(p.pid, 'r23fTempt', 0, ctx.name, {ref}); commit(); const a = await waitUntil(() => R22.ans[ref], 90000); if (a && a.idx[0] === 1) yes++; }
    for (let i = 0; i < yes; i++) await searchLibrary('a land card', 'put it onto the battlefield', ctx);
    shuffle(S.lib); log(`${ctx.name}: ${yes} opponent${yes === 1 ? '' : 's'} searched — searched ${yes} more time${yes === 1 ? '' : 's'}; shuffled`); ctx.r23tempt = 1; commit(); return true; }
  if (ctx.r23tempt && (/^each opponent may search their library for a land card and put it onto the battlefield$/.test(l) || /^for each opponent who searches a library this way, search your library for a land card and put it onto the battlefield$/.test(l) || /^then each player who searched a library this way shuffles$/.test(l) || /^(?:then )?put it onto the battlefield$/.test(l) || /^each opponent may search their library for a land card$/.test(l) || /^for each opponent who searches a library this way, search your library for a land card$/.test(l))) return true;
  // ---- Padeem
  if (/^if you control the artifact with the greatest mana value or tied for the greatest mana value, draw a card$/.test(l)){
    let best = -1, mine = -1; for (const b of boardsAll()) for (const c of b.bf){ if (!c.k || c.fd || !/Artifact/.test(b.pid === MYPID ? typeOf(c) : info(c.k)?.t || '')) continue; const mv = info(c.k)?.mv || 0; best = Math.max(best, mv); if (b.pid === MYPID) mine = Math.max(mine, mv); }
    if (mine >= 0 && mine === best){ draw(1); log(`${ctx.name}: controls the artifact with the greatest mana value — drew a card`); } commit(); return true; }
  // ---- Flare of Fortitude
  if (/^until end of turn, your life total can't change, and permanents you control gain hexproof and indestructible$/.test(l)){
    S.r23lock = {v:S.life, t:turnStr()}; S.bf.forEach(c => { if (!c.fd) c.ekw = [...new Set([...(c.ekw || []), 'hexproof', 'indestructible'])]; }); log(`${ctx.name}: life total locked at ${S.life}; their permanents gain hexproof and indestructible until end of turn`); commit(); return true; }
  // ---- Mesmeric Orb (done at each untap step by the setPhase hook)
  if (/^that permanent's controller mills a card$/.test(l) && /whenever a permanent becomes untapped/.test(full + otext)) return true;
  // ---- Single Combat split at ", then"
  if (/^each player chooses a creature or planeswalker they control$/.test(l) && /then sacrifices the rest/.test(full)){ await r23fKeep('crpw', ctx.name, MYPID); opponents().forEach(p => sendRq(p.pid, 'r23fKeep', 0, ctx.name, {d:'crpw'})); ctx.r23keepDone = 1; commit(); return true; }
  // ---- "each opponent / each player may …" decided on each player's own screen
  if ((m = l.match(/^(?:then )?each (opponent|player) may (draw a card(?: and create a 1\/1 white rabbit creature token)?|discard their hand and draw five cards)$/))){
    const what = m[2]; let yes = 0; const ps = m[1] === 'player' ? players() : opponents();
    for (const p of ps){
      let ok;
      if (p.pid === MYPID) ok = UI.dry ? true : await askYes(`${ctx.name}: you may ${what}. Do it?`, 'Yes', 'No');
      else ok = await r22ask(p.pid, `you may ${what}`, ctx.name);
      if (!ok) continue; yes++;
      if (p.pid === MYPID){ if (/^discard their hand/.test(what)){ S.hand.splice(0).forEach(c => S.gy.push(c)); draw(5); } else { draw(1); if (/rabbit/.test(what)) await createFromText('Create a 1/1 white Rabbit creature token', ctx); } }
      else if (/^discard their hand/.test(what)) sendRq(p.pid, 'r23fFlag', 0, ctx.name, {d:'wheel5'});
      else { sendRq(p.pid, 'draw', 1, ctx.name); if (/rabbit/.test(what)) sendRq(p.pid, 'tokText', 0, ctx.name, {d:'a 1/1 white Rabbit creature token'}); }
      if (p.pid !== MYPID) ctx.r23yesOpp = (ctx.r23yesOpp || 0) + 1;
      const gl = full.match(/each player who drew a card this way gains (\d+) life/); if (gl && /^draw a card$/.test(what)){ const n = +gl[1]; if (p.pid === MYPID){ if (gainLife(n, ctx.name)) log(`gained ${n} life → ${S.life}`); } else sendRq(p.pid, 'life', n, ctx.name); }
    }
    ctx.r23yes = yes; ctx.r23yesPids = true; log(`${ctx.name}: ${yes} player${yes === 1 ? '' : 's'} chose to ${what}`); commit(); return true; }
  if ((m = l.match(/^for each opponent who does, (.+)$/)) && ctx.r23yesPids){ const n = ctx.r23yesOpp || 0; for (let i = 0; i < n; i++) await doSentence(cap(s.slice(s.length - m[1].length)), ctx); return true; }
  if ((m = l.match(/^(?:then )?each player who drew a card this way gains (\d+) life$/)) && ctx.r23yesPids){ log(`${ctx.name}: each player who drew gains ${m[1]} life`); return true; }
  // ---- Teferi's Puzzle Box
  if (/^that player puts the cards in their hand on the bottom of their library in any order$/.test(l) && /then draws that many cards/.test(full + otext)){ ctx.r23puz = 1; const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp) || MYPID; if (pid === MYPID) r23fPuzzle(ctx.name); else sendRq(pid, 'r23fFlag', 0, ctx.name, {d:'puzzle'}); commit(); return true; }
  if (ctx.r23puz && /^(?:then )?draws that many cards$/.test(l)) return true;
  if (/^that player puts the cards in their hand on the bottom of their library in any order, then draws that many cards$/.test(l) || /^someone puts their hand on the bottom of their library and draws that many \(teferi's puzzle box\)$/.test(l)){
    const pid = ctx.it && (ctx.it.evPid || ctx.it.evDp) || MYPID; if (pid === MYPID) r23fPuzzle(ctx.name); else sendRq(pid, 'r23fFlag', 0, ctx.name, {d:'puzzle'}); commit(); return true; }
  // ---- Orim's Chant
  if (/^target player can't cast spells this turn$/.test(l)){ const t = tgt(); if (!t) return true; if (t.pid === MYPID) S.r23noCast = turnStr(); else sendRq(t.pid, 'r23fFlag', 0, ctx.name, {d:'noCast'}); log(`${ctx.name}: ${nameOf(t.pid)} can't cast spells this turn`); commit(); return true; }
  // ---- Overpowering Attack
  if (/^untap all creatures you control that attacked this turn$/.test(l)){ const ids = S.r23atk && S.r23atk.t === turnStr() ? S.r23atk.ids : []; let n = 0; S.bf.forEach(c => { if (ids.includes(c.id) && (c.tap || c.tn)){ c.tap = false; c.tn = 0; n++; } }); log(`${ctx.name}: untapped ${n} creature${n === 1 ? '' : 's'} that attacked this turn`); commit(); return true; }
  // ---- Summon: Fenrir
  if ((m = l.match(/^draw (a card|two cards) if you control the creature with the greatest power or tied for the greatest power$/))){
    let best = -99, mine = -99; boardsAll().forEach(b => b.bf.forEach(c => { if (!c.k || c.fd || !isCreatureCard(c)) return; const p = b.pid === MYPID ? stats(c)[0] : (parseInt(info(c.k)?.p) || 0) + (c.cp || 0) - (c.cm || 0); best = Math.max(best, p); if (b.pid === MYPID) mine = Math.max(mine, p); }));
    if (mine > -99 && mine === best){ draw(m[1] === 'a card' ? 1 : 2); log(`${ctx.name}: controls the creature with the greatest power — drew`); } commit(); return true; }
  // ---- damage prevention
  if ((m = l.match(/^prevent all (combat )?damage that would be dealt this turn by (non-([a-z]+) creatures|creatures your opponents control)$/))){
    S.r23prev = (S.r23prev || []).filter(x => x.t === turnStr()).concat({t:turnStr(), combat:!!m[1], non:m[3] ? cap(m[3]) : '', opp:!m[3]}); log(`${ctx.name}: ${m[0].replace(/^prevent/, 'preventing')}`); commit(); return true; }
  if (/^prevent all damage that would be dealt to you this turn$/.test(l)){ S.r23fogMe = turnStr(); log(`${ctx.name}: all damage to them is prevented this turn`); commit(); return true; }
  // ---- Endurance
  if (/^up to one target player puts all the cards from their graveyard on the bottom of their library in a random order$/.test(l)){ const t = tgt(); if (!t) return true; if (t.pid === MYPID) r23fGyBottom(ctx.name); else sendRq(t.pid, 'r23fFlag', 0, ctx.name, {d:'gyBottom'}); commit(); return true; }
  // ---- Coveted Jewel / Alexios: another player takes ~
  if ((m = l.match(/^(target player|that player) (draws three cards and )?gains control of ~(?:, untaps it, and puts a \+1\/\+1 counter on it)?$/))){
    const c = src(); const pid = /^target/.test(m[1]) ? (tgt() || {}).pid : (ctx.it && (ctx.it.evPid || ctx.it.evDp)); if (!pid) return true;
    if (m[2]){ if (pid === MYPID) draw(3); else sendRq(pid, 'draw', 3, ctx.name); }
    if (c && S.bf.includes(c)){ if (/untaps it/.test(l)){ c.tap = false; c.tn = 0; modCounters(c, 'cp', 1); } if (pid !== MYPID && !UI.dry) giveAway(single(c), pid, {perm:true}); }
    commit(); return true; }
  // ---- Angel's Grace / Everybody Lives!
  if (/^you can't lose the game this turn and your opponents can't win the game this turn$/.test(l)){ S.r23noLose = turnStr(); log(`${ctx.name}: they can't lose the game this turn`); commit(); return true; }
  if (/^until end of turn, damage that would reduce your life total to less than 1 reduces it to 1 instead$/.test(l)){ S.r23floor = turnStr(); log(`${ctx.name}: their life total can't be reduced below 1 by damage this turn`); commit(); return true; }
  if (/^all creatures gain hexproof and indestructible until end of turn$/.test(l)){ S.bf.forEach(c => { if (!c.fd && isCreatureCard(c)) c.ekw = [...new Set([...(c.ekw || []), 'hexproof', 'indestructible'])]; }); for (const [pid, st] of OPP) (st.bf || []).forEach(c => { if (c.k && !c.fd && isCreatureCard(c)) sendRq(pid, 'pump', 0, ctx.name, {tid:c.id, f:{p:0, t:0, kw:['hexproof', 'indestructible']}}); }); commit(); return true; }
  if (/^players gain hexproof until end of turn$/.test(l)){ S.r23plHx = turnStr(); log(`${ctx.name}: players have hexproof this turn`); commit(); return true; }
  if (/^players can't lose life this turn and players can't lose the game or win the game this turn$/.test(l)){ S.r23ell = turnStr(); S.r23noLose = turnStr(); log(`${ctx.name}: players can't lose life, lose or win the game this turn`); commit(); return true; }
  // ---- Homeward Path
  if (/^each player gains control of all creatures they own$/.test(l)){ r23fHomeward(); opponents().forEach(p => sendRq(p.pid, 'r23fFlag', 0, ctx.name, {d:'homeward'})); commit(); return true; }
  return false;
}
function r23fWarp(c, src){
  if (!c) return;
  if (c.tok){ moveCard(c.id, 'gy', {quiet:true}); log(`${cname(c)} (token) left the battlefield (${src})`); }
  else { moveCard(c.id, 'lib', {quiet:true}); shuffle(S.lib); log(`shuffled ${cname(c)} into their library (${src})`); }
  const top = S.lib[0]; if (!top){ commit(); return; }
  const a = info(top.k); log(`revealed ${a?.n || 'a card'} from the top of their library (${src})`);
  if (a && typeof isPermType === 'function' ? isPermType(a.t) : /\b(Creature|Artifact|Enchantment|Land|Planeswalker|Battle)\b/.test(a?.t || '')){ moveCard(top.id, 'bf'); log(`put ${a.n} onto the battlefield (${src})`); }
  commit();
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23fWarp'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c) r23fWarp(single(c), r.src); return; }
    if (r.op === 'r23fSearch'){ (async () => { const d = String(r.d || 'basic land card').replace(/[^a-z ]/gi, '').slice(0, 40); if (await askYes(`${r.src}: you may search your library for a ${d} and put it onto the battlefield${r.n ? ' tapped' : ''}. Search?`, 'Search', 'No')) await searchLibrary(`a ${d}`, `put it onto the battlefield${r.n ? ' tapped' : ''}, then shuffle`, {name:r.src}); commit(); })(); return; }
    return ao(r, from);
  };
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound23FPre(s, l, ctx)) return; return ds(s0, ctx); };
}

/* ---------- Animate Dead family ---------- */
async function r23fAnimate(ctx){
  const aura = srcCardOf(ctx); const nm = ctx.name;
  // candidates: creature cards in every graveyard
  const cands = S.gy.filter(c => isCreatureCard(c)).map(c => ({id:c.id, k:c.k, pid:MYPID}));
  for (const p of opponents()) (OPP.get(p.pid)?.gy || []).forEach((k, i) => { if (k && isCreatureCard({k})) cands.push({id:-5000 - cands.length, k, pid:p.pid}); });
  if (!cands.length){ log(`${nm}: no creature card in any graveyard`); if (aura && S.bf.includes(aura) && !UI.dry) moveCard(aura.id, 'gy'); return; }
  let pick = null; const t = ctx.lastT && ctx.lastT[0];
  if (t && t.k) pick = cands.find(x => x.pid === (t.pid || MYPID) && x.k === t.k);
  const ga = aura && aura.r23gyAtt; if (!pick && ga){ const k = ga.pid === MYPID || !ga.pid ? (S.gy.find(c => c.id === ga.id) || {}).k : (OPP.get(ga.pid)?.gy || [])[+String(ga.id).replace(/^g/, '')]; pick = cands.find(x => x.pid === (ga.pid || MYPID) && x.k === k && (x.pid !== MYPID || x.id === ga.id)); }
  if (!pick){ const ids = UI.dry ? [cands[0].id] : await pickCards({title:`${nm}: return which creature card? (any graveyard)`, cards:cands.map(x => ({id:x.id, k:x.k})), min:1, max:1}); pick = cands.find(x => x.id === (ids || [])[0]) || cands[0]; }
  if (UI.dry) return;
  if (pick.pid === MYPID){ const c = S.gy.find(x => x.id === pick.id); if (!c) return; moveCard(c.id, 'bf'); if (aura && S.bf.includes(aura)){ aura.att = {pid:MYPID, id:c.id}; aura.r23anim = c.id; } log(`${nm}: returned ${cname(c)} to the battlefield`); }
  else { if (aura) S.r23animWait = {aura:aura.id, k:pick.k, t:Date.now()}; sendRq(pick.pid, 'gytake', 0, nm, {d:pick.k}); log(`${nm}: takes ${info(pick.k)?.n} from ${nameOf(pick.pid)}'s graveyard`); }
  commit();
}
{
  const tc = takeCard;
  takeCard = function(r, from){
    const n0 = S.bf.length; const res = tc(r, from);
    try { const w = S.r23animWait; if (w && r.c && r.c.k === w.k && Date.now() - w.t < 120000){ const c = S.bf[S.bf.length - 1]; const aura = S.bf.find(b => b.id === w.aura); if (c && c.k === w.k && aura){ aura.att = {pid:MYPID, id:c.id}; aura.r23anim = c.id; } S.r23animWait = null; commit(); } } catch (e){ console.warn(e); }
    return res;
  };
  // when the Aura leaves, the creature's controller sacrifices it
  const ol = onLeave;
  onLeave = function(c, to, ...a){
    const r = ol(c, to, ...a);
    try { if (c && c.r23anim != null && !UI.dry){ const id = c.r23anim; c.r23anim = null; const t = S.bf.find(b => b.id === id); if (t){ log(`${cname(c)} left the battlefield — sacrificing ${cname(t)}`); setTimeout(() => { if (S.bf.includes(t)){ sacrificeOne(t); commit(); } }, 0); }
      } if (c) c.r23gab = null; } catch (e){ console.warn(e); }
    return r;
  };
}
/* ---------- Living Death ---------- */
function r23fLivingDeath(src){
  const ex = S.gy.filter(c => isCreatureCard(c)); ex.forEach(c => moveCard(c.id, 'ex', {quiet:true}));
  const cr = S.bf.filter(c => !c.fd && isCreatureCard(c)); cr.forEach(c => { const n = c.n || 1; for (let i = 0; i < n; i++) sacrificeOne(S.bf.includes(c) ? c : null); });
  ex.forEach(c => { if (find(c.id)[0] === 'ex') moveCard(c.id, 'bf', {quiet:true}); });
  log(`${src}: exiled ${ex.length} creature card${ex.length === 1 ? '' : 's'}, sacrificed ${cr.length} creature${cr.length === 1 ? '' : 's'}, returned the exiled cards to the battlefield`);
  commit();
}
/* ---------- Spells this turn by color (Veil of Summer), can't be countered, hexproof from colors ---------- */
{
  const bc = beginCast;
  beginCast = async function(c, zone, ...a){ const n0 = S ? S.stk.length : 0; const r = await bc.call(this, c, zone, ...a);
    try { if (S && c && c.k && S.stk.length > n0){ const T = turnStr(); if (!S.r23cc || S.r23cc.t !== T) S.r23cc = {t:T, c:''}; const col = info(c.k)?.c || ''; for (const x of String(col)) if (/[WUBRG]/.test(x) && !S.r23cc.c.includes(x)) S.r23cc.c += x; const it = S.stk[S.stk.length - 1]; if (it && S.r23uc === T) it.uc = true; } } catch {}
    return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = turnStr(); if (S.r23cc && S.r23cc.t === T) o.r23cc = {t:T, c:S.r23cc.c}; if (S.r23uc === T) o.r23uc = T; if (S.r23hx && S.r23hx.t === T) o.r23hx = {t:T, c:S.r23hx.c}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { const cl = v => String(v || '').replace(/[^WUBRG]/g, '').slice(0, 5); if (s.r23cc) o.r23cc = {t:String(s.r23cc.t).slice(0, 20), c:cl(s.r23cc.c)}; if (s.r23uc) o.r23uc = String(s.r23uc).slice(0, 20); if (s.r23hx) o.r23hx = {t:String(s.r23hx.t).slice(0, 20), c:cl(s.r23hx.c)}; } catch {} return o; };
  const cl = counterLegal;
  counterLegal = function(it, cs){ const r = cl(it, cs); try { if (r && r.ok && it && it.kind === 'spell'){ const T = turnStr(); const uc = it.pid === MYPID ? S.r23uc === T : (OPP.get(it.pid)?.r23uc === T); if (uc) return {ok:false, why:"that player's spells can't be countered this turn"}; } } catch {} return r; };
  const tcd = targetCands;
  targetCands = function(spec, srcx){ const out = tcd(spec, srcx);
    try { const T = turnStr(); const hx = pid => { const h = pid === MYPID ? S.r23hx : OPP.get(pid)?.r23hx; return h && h.t === T ? h.c : ''; };
      const scol = String((srcx && srcx.col) || ''); const spid = srcx && srcx.pid;
      out.forEach(o => { if (!o.ok || !o.pid || o.pid === spid) return; const h = hx(o.pid); if (h && [...scol].some(x => h.includes(x))) { o.ok = false; o.why = 'hexproof from that color'; } }); } catch {}
    return out; };
}

/* ---------- abilities a permanent gained (Urza's Saga) ---------- */
{
  const ma = manaAbs;
  manaAbs = function(c){ const out = ma(c); if (!c || !c.r23gab || !c.r23gab.length) return out; const add = [];
    for (const line of c.r23gab){ const m = line.match(/^([^:]+):\s*(add .+?)\.?$/i); if (!m || out.some(o => o.line === line)) continue; add.push({cost:m[1].trim(), eff:m[2], rest:'', outs:manaOuts(m[2]), tapOnly:/^\{t\}$/i.test(m[1].trim()), line}); }
    return add.length ? out.concat(add) : out; };
  const al = abilityList;
  abilityList = function(c){ const out = al(c); if (!c || !c.r23gab || !c.r23gab.length) return out; const add = [];
    for (const line of c.r23gab){ const m = line.match(/^([^:]+):\s*([\s\S]+)$/); if (!m || /^add\b/i.test(m[2]) || out.some(o => o.line === line)) continue; add.push({cost:m[1].trim(), eff:m[2].trim(), sorc:/activate only as a sorcery/i.test(m[2]), line}); }
    return add.length ? out.concat(add) : out; };
}
/* ---------- Playing the top card of your library (Bolas's Citadel, Future Sight, Courser of Kruphix …) ---------- */
STATIC_RULES.push(
  [/^you may play lands and cast spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true, spells:'any'})],
  [/^if you cast a spell this way, pay life equal to its mana value rather than pay its mana cost$/, m => ({kind:'r23fTopLife', who:'you'})],
  [/^as long as ~ is attached to a creature, you may play lands and cast spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true, spells:'any', attached:true})],
  [/^you may play historic lands and cast historic spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:'historic', spells:'historic'})],
  [/^you may play lands and cast ([a-z]+) spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true, spells:m[1]})],
  [/^as long as you control three or more creatures with different powers, you may cast creature spells from the top of your library$/, m => ({kind:'r23fTop', who:'you', spells:'creature', augur:true})],
  [/^you may play lands from the top of your library$/, m => ({kind:'r23fTop', who:'you', lands:true})],
);
function r23fHistoric(k){ const t = info(k)?.t || ''; return /\b(Artifact|Legendary|Saga)\b/.test(t); }
function r23fTopWays(c){
  if (!S || !c) return [];
  const land = isLand(c.k); const a = info(c.k); if (!a) return []; const mv = a.mv || 0; const out = [];
  for (const r of rulesOn('r23fTop')){
    if (r.attached){ const me = S.bf.find(b => !b.fd && info(b.k)?.n === r.src); if (!me || !me.att) continue; }
    if (r.augur){ const pw = new Set(S.bf.filter(b => !b.fd && isCreatureCard(b)).map(b => stats(b)[0])); if (pw.size < 3) continue; }
    if (land){ if (r.lands === true || (r.lands === 'historic' && r23fHistoric(c.k))) out.push({r, land:true}); continue; }
    if (!r.spells) continue;
    if (r.spells === 'any' || (r.spells === 'historic' && r23fHistoric(c.k)) || (r.spells !== 'historic' && descOk(c.k, r.spells))) out.push({r, life:rulesOn('r23fTopLife').some(x => x.src === r.src)});
  }
  for (const r of rulesOn('topPlay')){
    if (land){ if (r.landsOnly || r.mv > 0 && !r.creaturesOnly) out.push({r, land:true}); continue; }
    if (r.landsOnly) continue;
    if (r.creaturesOnly && !isCreatureCard(c)) continue;
    if (r.desc && !descOk(c.k, r.desc)) continue;
    if (!r.creaturesOnly && !r.desc && r.mv > 0 && mv < r.mv) continue;
    if (!r.creaturesOnly && !r.desc && !r.mv){ const sc = S.bf.find(b => info(b.k)?.n === r.src); if (!(sc && sc.ctype && isCreatureCard(c) && new RegExp('\\b' + sc.ctype + '\\b', 'i').test(a.t || ''))) continue; }
    out.push({r});
  }
  return out;
}
async function r23fPlayTop(useLife){
  const c = S.lib[0]; if (!c) return; const ways = r23fTopWays(c); if (!ways.length){ toast(`Nothing lets you play ${cname(c)} from the top of your library`); return; }
  if (isLand(c.k)){ playLand(c, {}); commit(); return; }
  const w = useLife ? ways.find(x => x.life) : ways.find(x => !x.life) || ways[0];
  if (w && w.life){ const mv = info(c.k)?.mv || 0; const n0 = S.stk.length; await beginCast(c, 'lib', {free:true}); if (S.stk.length > n0){ S.life -= mv; log(`paid ${mv} life instead of the mana cost (${w.r.src}) → ${S.life}`); commit(); } return; }
  await beginCast(c, 'lib', {});
  commit();
}
{
  const lm = libMenu;
  libMenu = function(x, y){
    lm(x, y);
    try { const c = S.lib[0]; if (!c) return; const ways = r23fTopWays(c); if (!ways.length) return;
      const menu = document.getElementById('menu'); if (!menu) return;
      const nm = esc(cname(c)); let h = `<div class="mh">Top card: ${nm} (${esc(ways.map(w => w.r.src).filter((v, i, a) => a.indexOf(v) === i).join(', '))})</div>`;
      if (ways.some(w => !w.life)) h += mb('r23fTop', isLand(c.k) ? `Play ${nm} from the top` : `Cast ${nm} from the top`);
      if (ways.some(w => w.life)) h += mb('r23fTopLife', `Cast ${nm} from the top, paying ${info(c.k)?.mv || 0} life`);
      menu.insertAdjacentHTML('afterbegin', h + '<div class="sep"></div>');
    } catch (e){ console.warn(e); }
  };
  ACT.r23fTop = () => { closeMenu(); r23fPlayTop(false); };
  ACT.r23fTopLife = () => { closeMenu(); r23fPlayTop(true); };
}

/* ---------- "You may cast ~ as though it had flash" (Necromancy) ---------- */
STATIC_RULES.push([/^if you cast it any time a sorcery couldn't have been cast, the controller of the permanent it becomes sacrifices it at the beginning of the next cleanup step$/, m => ({kind:'r23fNecroEnd', who:'you'})]);
STATIC_KNOWN.push(/^you may cast ~ as though it had flash$/);
{
  const to = timingOk;
  timingOk = function(c){ const r = to(c); try { if (r && !r.ok && c && c.k && phaseNow().n > 0 && !/split second/i.test(r.why || '') && /^you may cast (?:~|this spell) as though it had flash\.?(?: |$)/im.test(tname(info(c.k)?.o || '', info(c.k)?.n))){ UI.r23flashCast = c.id; return {ok:true}; } } catch {} return r; };
  const oe = onEnter;
  onEnter = function(c, from, o = {}){ const r = oe(c, from, o); try { if (c && UI.r23flashCast === c.id){ UI.r23flashCast = null; if (/sacrifices it at the beginning of the next cleanup step/i.test(info(c.k)?.o || '')){ S.r23eot = (S.r23eot || []).concat({id:c.id, t:turnStr()}); log(`${cname(c)} was cast at instant speed — it will be sacrificed at end of turn`); } } } catch {} return r; };
  const fs = fireSteps;
  fireSteps = function(...a){ const r = fs.apply(this, a);
    try { const [step] = a; if (S && step === 'end' && S.r23eot && S.r23eot.length){ const T = turnStr(); const due = S.r23eot.filter(x => x.t === T); S.r23eot = S.r23eot.filter(x => x.t !== T); due.forEach(x => { const c = S.bf.find(b => b.id === x.id); if (c){ log(`sacrificed ${cname(c)} (cast at instant speed)`); sacrificeOne(c); } }); if (due.length) commit(); } } catch (e){ console.warn(e); }
    return r; };
}

/* ---------- helpers for batch 3 ---------- */
function r23fPhaseOut(t, src){
  if (!t || t.t !== 'card') return;
  if (t.pid === MYPID || !t.pid){ const c = S.bf.find(b => b.id === t.id); if (!c) return; const i = S.bf.indexOf(c); S.bf.splice(i, 1); (S.poz = S.poz || []).push(c); log(`${cname(c)} phased out (${src})`); }
  else { sendRq(t.pid, 'r23fPhase', 0, src, {tid:t.id}); log(`${t.nm || 'a permanent'} phases out (${src})`); }
}
function r23fPlague(d, src){
  const pool = S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok}));
  if (pool.length) addChoicePrompt('sac', d, 1, MYPID, src); else if (S.hand.length) addChoicePrompt('discard', '', 1, MYPID, src); else log(`has nothing to sacrifice or discard (${src})`);
}
async function r23fTormentMe(n, src){
  for (let i = 0; i < n; i++){
    const perms = S.bf.filter(c => !c.fd && !isLand(c.k)); const opts = [{label:'Lose 3 life', value:'life'}];
    if (perms.length) opts.push({label:'Sacrifice a nonland permanent', value:'sac'}); if (S.hand.length) opts.push({label:'Discard a card', value:'disc'});
    const v = opts.length === 1 ? 'life' : await askChoice({title:`${src} (${i + 1} of ${n}): lose 3 life unless you sacrifice a nonland permanent or discard a card`, options:opts});
    if (v === 'sac'){ const ids = await pickCards({title:`${src}: sacrifice a nonland permanent`, cards:perms, min:1, max:1}); const c = S.bf.find(x => x.id === (ids || [])[0]) || perms[0]; sacrificeOne(c); }
    else if (v === 'disc'){ const ids = await pickCards({title:`${src}: discard a card`, cards:S.hand.slice(), min:1, max:1}); const c = S.hand.find(x => x.id === (ids || [])[0]) || S.hand[0]; if (c) moveCard(c.id, 'gy'); }
    else { S.life -= 3; log(`lost 3 life (${src}) → ${S.life}`); }
    commit();
  }
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23fPhase'){ const c = r.tid != null ? S.bf.find(b => b.id === r.tid) : null; if (c){ const s1 = single(c); const i = S.bf.indexOf(s1); if (i >= 0){ S.bf.splice(i, 1); (S.poz = S.poz || []).push(s1); log(`${cname(s1)} phased out (${r.src})`); } } commit(); return; }
    if (r.op === 'r23fTorment'){ r23fTormentMe(Math.min(+r.n || 0, 99), r.src); return; }
    if (r.op === 'r23fMaySac'){ (async () => { const types = String(r.d || '').split(/\s+/).filter(Boolean); const pool = S.bf.filter(c => !c.fd && types.some(t => new RegExp('\\b' + t + '\\b').test(typeOf(c))));
      let did = 0; if (pool.length){ const opts = pool.map(c => ({label:`Sacrifice ${cname(c)}`, value:c.id})).concat({label:"Don't sacrifice (you lose life, they draw)", value:-1}); const v = await askChoice({title:`${r.src}: you may sacrifice a permanent that shares a card type (${types.join(', ').toLowerCase()})`, options:opts}); const c = S.bf.find(x => x.id === v); if (c){ sacrificeOne(c); did = 1; } }
      sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:String(did)}); commit(); })(); return; }
    if (r.op === 'r23fFlag'){
      const d = String(r.d || '');
      if (d === 'manifest'){ if (S.lib[0] && typeof r21bManifest === 'function') r21bManifest(S.lib[0], r.src); commit(); return; }
      if (d === 'livingDeath'){ r23fLivingDeath(r.src); return; }
      if (d.startsWith('plague:')){ r23fPlague(d.slice(7) === 'creature' ? 'creature' : 'creature or planeswalker', r.src); commit(); return; }
      return;
    }
    return ao(r, from);
  };
  // Syr Konrad: a creature card put into a graveyard from anywhere but the battlefield / leaving your graveyard
  EV_TYPES.push('r23crgy');
  const mc = moveCard;
  moveCard = function(id, to, o = {}){ const [from, , c] = find(id); const r = mc(id, to, o);
    try { if (c && S && !UI.dry && !UI.r23mill && from && from !== 'bf' && from !== 'gy' && to === 'gy' && find(id)[0] === 'gy' && isCreatureCard(c)) emit({type:'r23crgy', k:c.k, id:c.id, cnt:1}); } catch {}
    return r; };
  const tg = trigsOf;
  trigsOf = function(k, fl){ const out = tg(k, fl); if (out.r23f) return out;
    const o = tname(info(k)?.o || '', info(k)?.n);
    if (/^whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, ~ deals 1 damage to each opponent\.?$/im.test(o)){
      const base = out.find(t => t.ev === 'die'); const eff = '~ deals 1 damage to each opponent.';
      if (base){ base.eff = eff; out.push({...base, ev:'r23crgy', subj:'any', ctl:'any', desc:'', eff}); out.push({...base, ev:'leavegy', subj:'any', ctl:'you', desc:'creature', eff}); }
    }
    out.r23f = true; return out; };
  const sm = subjMatch;
  subjMatch = function(t, src, ev, pid){ if (ev && ev.type === 'r23crgy') return true; return sm(t, src, ev, pid); };
  // creatures that must attack this turn (Bident of Thassa)
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { const pn = phaseNow(); const T = turnStr(); const on = [...OPP.values()].some(st => st.r23must === T);
      if (pn.mine && S.cb && S.cb.step === 'atk' && on){ const miss = S.bf.filter(c => !c.fd && isCreatureCard(c) && !canAttack(c) && !UI.atkSel[c.id]); if (miss.length){ toast(`${miss.map(cname).slice(0, 4).join(', ')} must attack this turn if able`); return; } } } catch (e){ console.warn(e); }
    return da.apply(this, a);
  };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S.r23must === turnStr()) o.r23must = S.r23must; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s.r23must) o.r23must = String(s.r23must).slice(0, 20); } catch {} return o; };
}

{
  const cbk = canBlock;
  canBlock = function(b, a, apid){ const r = cbk(b, a, apid); if (r) return r;
    try { if (b && b.goad && b.goad.by){ const by = b.goad.by; const st = by === MYPID ? S : OPP.get(by); const nb = st && st.r23noBlk; if (nb){ const [n, pid] = currentTurn(); if (!(pid === by && n > nb.n)) return "can't block (Taunt from the Rampart)"; } } } catch {}
    return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S.r23noBlk) o.r23noBlk = {n:+S.r23noBlk.n || 0}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s.r23noBlk) o.r23noBlk = {n:+s.r23noBlk.n || 0}; } catch {} return o; };
}

/* ---------- Damage replacement: City on Fire (x3, spells too), Torbran (+2 red), Solphim (x2 noncombat) ---------- */
STATIC_RULES.push(
  [/^if a source you control would deal damage to a permanent or player, it deals triple that damage instead$/, m => ({kind:'r23fX3', who:'you'})],
  [/^if a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus (\d+) instead$/, m => ({kind:'r23fPlus', who:'you', n:+m[1], col:'R'})],
  [/^if a source you control would deal noncombat damage to an opponent or a permanent an opponent controls, it deals double that damage to that player or permanent instead$/, m => ({kind:'r23fNcX2', who:'you'})],
);
{
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){
    try { if (S && n > 0 && t){
      const opp = t.pid && t.pid !== MYPID;
      if (opp) for (const r of rulesOn('r23fPlus')){ const col = (srcCard && srcCard.k ? info(srcCard.k)?.c : info(srcK)?.c) || ''; if (String(col).includes(r.col)) n += r.n; }
      if (opp && !UI.r23cmb) for (const r of rulesOn('r23fNcX2')) n *= 2;
      for (const r of rulesOn('r23fX3')) n *= 3;
    } } catch (e){ console.warn(e); }
    return dd(t, n, srcK, srcCard, extra);
  };
  const ad = attackerDamage;
  attackerDamage = async function(...a){ UI.r23cmb = (UI.r23cmb || 0) + 1; try { return await ad.apply(this, a); } finally { UI.r23cmb--; } };
  const dt = defenderTick;
  defenderTick = function(...a){ UI.r23cmb = (UI.r23cmb || 0) + 1; try { return dt.apply(this, a); } finally { UI.r23cmb--; } };
}
/* ---------- Trigger doublers keyed on the source (Harmonic Prodigy, Delney, Annie Joins Up, Echoes of Eternity, Veyran, Traveling Chocobo) ---------- */
STATIC_RULES.push(
  [/^if a triggered ability of an? ([a-z]+) or another ([a-z]+) you control triggers, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', a:m[1], b:m[2]})],
  [/^if a triggered ability of a creature you control with power (\d+) or less triggers, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', pow:+m[1]})],
  [/^if a triggered ability of a legendary creature you control triggers, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', legend:true})],
  [/^if a triggered ability of a colorless spell you control or another colorless permanent you control triggers, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', colorless:true})],
  [/^if you casting or copying an instant or sorcery spell causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', instSorc:true})],
  [/^if a land or ([a-z]+) you control entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time$/, m => ({kind:'r23fTrig', who:'you', enterDesc:'land or ' + m[1]})],
);
{
  const tm = trigMult;
  trigMult = function(ev, src){ let n = tm(ev, src); if (!ev || !S) return n;
    try { const c = src && src.id != null ? S.bf.find(b => b.id === src.id) : null; const k = (c && c.k) || (src && src.k); const ty = k ? (c ? typeOf(c) : info(k)?.t || '') : '';
      for (const r of rulesOn('r23fTrig')){
        const me = S.bf.find(b => info(b.k)?.n === r.src);
        if (r.a){ if (!k || !c) continue; const isA = new RegExp('\\b' + r.a + '\\b', 'i').test(ty); const isB = new RegExp('\\b' + r.b + '\\b', 'i').test(ty) && (!me || me.id !== c.id); if (isA || isB) n++; continue; }
        if (r.pow != null){ if (c && isCreatureCard(c) && stats(c)[0] <= r.pow) n++; continue; }
        if (r.legend){ if (c && isCreatureCard(c) && /Legendary/.test(ty)) n++; continue; }
        if (r.colorless){ if (c && !(info(c.k)?.c || '').replace(/[^WUBRG]/g, '') && (!me || me.id !== c.id)) n++; continue; }
        if (r.instSorc){ if (ev.type === 'cast' && ev.k && /\b(Instant|Sorcery)\b/.test(info(ev.k)?.t || '') && UI.r23evPid === MYPID && c) n++; continue; }
        if (r.enterDesc){ if (ev.type === 'enter' && UI.r23evPid === MYPID && ev.k && descOk(ev.k, r.enterDesc, {tok:ev.tok}) && c) n++; continue; }
      }
    } catch (e){ console.warn(e); }
    return Math.min(n, 8); };
}
{
  const he = handleEvent;
  handleEvent = function(pid, ev){ const p0 = UI.r23evPid; UI.r23evPid = pid; try { return he(pid, ev); } finally { UI.r23evPid = p0; } };
}

/* ---------- Auras that enchant a card in a graveyard wait for their own trigger; targets after "the owner of target permanent shuffles …" ---------- */
{
  const ab = attachSBA;
  attachSBA = function(...a){ const keep = [];
    try { for (const s of S.bf) if (s.att && !s.r23anim && /^enchant creature card in a graveyard$/im.test(info(s.k)?.o || '')){ keep.push([s, s.att]); delete s.att; } } catch {}
    const r = ab.apply(this, a); keep.forEach(([s, at]) => { if (!s.att) s.r23gyAtt = at; }); return r; };
  const ts = targetSpecs;
  targetSpecs = function(t){ const out = ts(t); try { out.forEach(sp => { const m = sp && sp.zone === 'bf' && typeof sp.desc === 'string' && sp.desc.match(/^(.+?) (?:shuffles|puts|reveals)\b/); if (m) sp.desc = m[1]; }); } catch {} return out; };
  const ml = mill;
  mill = function(n = 1, ...a){ const before = new Set(S.gy.map(c => c.id)); UI.r23mill = 1; let r; try { r = ml(n, ...a); } finally { UI.r23mill = 0; }
    try { if (!UI.dry) S.gy.filter(c => !before.has(c.id) && isCreatureCard(c)).forEach(c => emit({type:'r23crgy', k:c.k, id:c.id, cnt:1})); } catch {}
    return r; };
}

/* ---------- batch 5 helpers ---------- */
function r23fAllIsDust(src){
  const list = S.bf.filter(c => !c.fd && String(info(c.k)?.c || '').replace(/[^WUBRG]/g, '')); list.forEach(c => { const n = c.n || 1; for (let i = 0; i < n; i++) if (S.bf.includes(c)) sacrificeOne(c); });
  log(`${src}: sacrificed ${list.length} colored permanent${list.length === 1 ? '' : 's'}`); commit();
}
async function r23fKeep(mode, src, castPid){
  let keepIds = []; let pool = [];
  if (mode === 'types'){
    const types = ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle']; pool = S.bf.filter(c => !c.fd);
    for (const ty of types){ const of = pool.filter(c => new RegExp('\\b' + ty + '\\b').test(typeOf(c))); if (!of.length) continue; if (of.some(c => keepIds.includes(c.id))) continue;
      const ids = of.length === 1 || UI.dry ? [of[0].id] : await pickCards({title:`${src}: choose a ${ty.toLowerCase()} to keep (the rest are sacrificed)`, cards:of, min:1, max:1}); keepIds.push((ids || [of[0].id])[0]); }
  } else {
    const d = mode === 'crpw' ? 'creature or planeswalker' : 'creature'; pool = S.bf.filter(c => !c.fd && descOk(c.k, d, {tok:c.tok}));
    const n = mode.startsWith('cr:') ? +mode.slice(3) : 1; const min = mode.startsWith('cr:') ? 0 : 1;
    if (pool.length && !(mode.startsWith('cr:') && pool.reduce((a, c) => a + (c.n || 1), 0) <= n)){ const ids = UI.dry ? pool.slice(0, n).map(c => c.id) : await pickCards({title:`${src}: choose ${mode.startsWith('cr:') ? 'up to ' + n + ' creatures' : 'a ' + d} to keep — the rest are sacrificed`, cards:pool, min:Math.min(min, pool.length), max:n}); keepIds = ids || []; }
    else keepIds = pool.map(c => c.id);
    if (mode === 'vow') keepIds.forEach(id => { const c = S.bf.find(b => b.id === id); if (c){ addNamed(c, 'vow', 1); c.r23vow = castPid; } });
  }
  if (UI.dry) return;
  const gone = pool.filter(c => !keepIds.includes(c.id)); gone.forEach(c => { const n = c.n || 1; for (let i = 0; i < n; i++) if (S.bf.includes(c)) sacrificeOne(c); });
  log(`${src}: kept ${keepIds.length}, sacrificed ${gone.length}`); commit();
}
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23fKeep'){ const d = String(r.d || ''); if (/^(types|vow|crpw|cr:\d)$/.test(d)) r23fKeep(d, r.src, from); return; }
    if (r.op === 'r23fTempt'){ (async () => { const yes = await askYes(`${r.src}: tempting offer — search your library for a land card and put it onto the battlefield? (${nameOf(from)} then searches again)`, 'Search', 'No'); if (yes){ await searchLibrary('a land card', 'put it onto the battlefield, then shuffle', {name:r.src}); } sendRq(from, 'r22pickAns', 1, r.src, {ref:r.ref, d:yes ? '1' : '0'}); commit(); })(); return; }
    if (r.op === 'r23fFlag' && r.d === 'allIsDust'){ r23fAllIsDust(r.src); return; }
    return ao(r, from);
  };
  // life total can't change until end of turn (Flare of Fortitude)
  const cm = commit;
  commit = function(...a){ try { if (S && S.r23lock){ if (S.r23lock.t !== turnStr()) S.r23lock = null; else if (S.life !== S.r23lock.v) S.life = S.r23lock.v; } } catch {} return cm.apply(this, a); };
  // vow counters: can't attack the caster (Promise of Loyalty)
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { for (const [id, def] of Object.entries(UI.atkSel || {})){ if (!def) continue; const c = S.bf.find(x => x.id === +id); const d = parseDef(def); if (c && c.r23vow && (c.nc || {}).vow > 0 && d && attackTargetProtector(d) === c.r23vow){ toast(`${cname(c)} has a vow counter: it can't attack ${nameOf(c.r23vow)} or their planeswalkers`); return; } } } catch (e){ console.warn(e); }
    return da.apply(this, a); };
  // Single Combat: no creature or planeswalker spells until the end of the caster's next turn
  const cc = castCheck;
  castCheck = function(c, zone){ const r = cc(c, zone); try { if (r && r.ok && c && c.k && /\b(Creature|Planeswalker)\b/.test(info(c.k)?.t || '') && r23fNoCrOn()) return {ok:false, why:"Single Combat: players can't cast creature or planeswalker spells now"}; } catch {} return r; };
  const tc = turnChanged;
  turnChanged = function(...a){ const r = tc.apply(this, a); try { const f = S && S.r23noCr; if (f){ const [n, pid] = currentTurn(); if (pid === MYPID && n > f.n && f.my == null){ f.my = n; commit(); } else if (f.my != null && n > f.my){ S.r23noCr = null; commit(); } } } catch {} return r; };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { if (S.r23noCr) o.r23noCr = {n:+S.r23noCr.n || 0, my:S.r23noCr.my == null ? null : +S.r23noCr.my}; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (s.r23noCr) o.r23noCr = {n:+s.r23noCr.n || 0, my:s.r23noCr.my == null ? null : +s.r23noCr.my}; } catch {} return o; };
  // Mesmeric Orb: each permanent that untaps mills its controller a card
  const sp = setPhase;
  setPhase = function(i, ...a){
    if (i !== 0 || !S) return sp.call(this, i, ...a);
    const tapped = S.bf.filter(c => c.tap || (c.tn || 0) > 0).map(c => [c, (c.n || 1) > 1 ? (c.tn || 0) : 1]);
    const r = sp.call(this, i, ...a);
    try { const orbs = S.bf.concat(...[...OPP.values()].map(st => st.bf || [])).filter(b => b.k && !b.fd && /^whenever a permanent becomes untapped, that permanent's controller mills a card\.?$/im.test(info(b.k)?.o || '')).length;
      if (orbs){ const n = tapped.reduce((a2, [c, k]) => a2 + (S.bf.includes(c) && !c.tap && !(c.tn > 0) ? k : 0), 0) * orbs; if (n){ mill(n); log(`Mesmeric Orb: milled ${n} (${n} permanent untap${n === 1 ? '' : 's'})`); commit(); } } } catch (e){ console.warn(e); }
    return r; };
  const ct = classifyTrig;
  classifyTrig = function(w, c){
    if (/^a permanent becomes untapped$/.test(c)) return {ev:'manaHandled', subj:'any', ctl:'any', desc:''};
    if (/^you lose life$/.test(c)) return {ev:'loselife', subj:'any', ctl:'you', desc:''};
    return ct(w, c); };
}
function r23fNoCrOn(){ const chk = f => f && !(f.my != null && currentTurn()[0] > f.my); if (S && chk(S.r23noCr)) return true; for (const st of OPP.values()) if (chk(st.r23noCr)) return true; return false; }

function r23fPuzzle(src){ const n = S.hand.length; S.lib.push(...S.hand.splice(0)); if (n) draw(n); log(`${src}: put ${n} card${n === 1 ? '' : 's'} from their hand on the bottom of their library and drew ${n}`); commit(); }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23fFlag' && r.d === 'wheel5'){ const n = S.hand.length; S.hand.splice(0).forEach(c => S.gy.push(c)); draw(5); log(`discarded their hand (${n}) and drew five (${r.src})`); commit(); return; }
    if (r.op === 'r23fFlag' && r.d === 'puzzle'){ r23fPuzzle(r.src); return; }
    return ao(r, from);
  };
}

/* ---------- batch 6: casting bans, prevention, hand size, attack/block limits ---------- */
STATIC_RULES.push(
  [/^your maximum hand size is twenty$/, m => ({kind:'maxHand', who:'you', n:20})],
  [/^each opponent's maximum hand size is reduced by (seven|\d+)$/, m => ({kind:'r23fHandRed', who:'opp', n:wn(m[1]) || +m[1] || 7})],
  [/^no more than (one|two) creatures? can attack each combat$/, m => ({kind:'r23fAtkMax', who:'all', n:wn(m[1])})],
  [/^no more than (one|two) creatures? can block each combat$/, m => ({kind:'r23fBlkMax', who:'all', n:wn(m[1])})],
  [/^no more than (one|two) creatures? can attack you each combat$/, m => ({kind:'r23fAtkMeMax', who:'opp', n:wn(m[1])})],
);
function r23fGyBottom(src){ const g = S.gy.splice(0); shuffle(g); S.lib.push(...g); log(`${src}: put ${g.length} card${g.length === 1 ? '' : 's'} from their graveyard on the bottom of their library`); commit(); }
{
  const ao = applyOp;
  applyOp = function(r, from){
    if (r.op === 'r23fFlag' && r.d === 'noCast'){ S.r23noCast = turnStr(); log(`can't cast spells this turn (${r.src})`); commit(); return; }
    if (r.op === 'r23fFlag' && r.d === 'gyBottom'){ r23fGyBottom(r.src); return; }
    return ao(r, from);
  };
  const cc = castCheck;
  castCheck = function(c, zone){ const r = cc(c, zone); try { if (r && r.ok && S && S.r23noCast === turnStr() && c && !isLand(c.k)) return {ok:false, why:"You can't cast spells this turn (Orim's Chant)"}; } catch {} return r; };
  const bc = beginCast;
  beginCast = async function(c, zone, o = {}, ...a){ try { if (S && S.r23noCast === turnStr() && c && !isLand(c.k)){ toast("You can't cast spells this turn"); return; } } catch {} return bc.call(this, c, zone, o, ...a); };
  // prevention: by creatures (checked where the damage is dealt), to me (checked where it is taken)
  const dd = dealDamage;
  dealDamage = function(t, n, srcK, srcCard, extra){
    try { if (S && n > 0 && srcCard && S.bf.includes(srcCard) && isCreatureCard(srcCard)){ const T = turnStr();
      const lists = [[MYPID, S.r23prev || []]].concat([...OPP.entries()].map(([pid, st]) => [pid, st.r23prev || []]));
      for (const [pid, list] of lists) for (const x of list){ if (x.t !== T) continue; if (x.combat && !UI.r23cmb) continue; if (x.opp && pid === MYPID) continue; if (x.non && new RegExp('\\b' + x.non + '\\b', 'i').test(typeOf(srcCard))) continue; log(`damage from ${cname(srcCard)} prevented`); return; } } } catch (e){ console.warn(e); }
    return dd(t, n, srcK, srcCard, extra); };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ if (S && S.r23fogMe === turnStr() && n > 0){ log('damage to me prevented'); return; } return dm(n, f, from); };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = turnStr(); const l = (S.r23prev || []).filter(x => x.t === T); if (l.length) o.r23prev = l.slice(0, 4); } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { if (Array.isArray(s.r23prev)) o.r23prev = s.r23prev.slice(0, 4).map(x => ({t:String(x.t).slice(0, 20), combat:!!x.combat, opp:!!x.opp, non:String(x.non || '').replace(/[^A-Za-z]/g, '').slice(0, 16)})); } catch {} return o; };
  // hand size reduced by an opponent's permanent (Jin-Gitaxias, Core Augur)
  const ch = cleanupHand;
  cleanupHand = async function(){
    const red = rulesOn('r23fHandRed').reduce((a, x) => a + x.n, 0); if (!red || noMaxHand()) return ch();
    const own = rulesOn('maxHand').filter(x => x.pid === MYPID); const base = own.length ? Math.min(...own.map(x => x.n)) : 7; const max = Math.max(0, base - red); const over = S.hand.length - max; if (over <= 0) return;
    let ids = null; while (!ids){ ids = await pickCards({title:`Cleanup: discard ${over} card${over > 1 ? 's' : ''} (maximum hand size ${max})`, cards:S.hand.slice(), min:over, max:over, noClose:true}); }
    ids.forEach(id => moveCard(id, 'gy', {manual:true})); log(`discarded down to ${max}`); commit(); };
  // attack / block limits; remember who attacked this turn
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { const sel = Object.entries(UI.atkSel || {}).filter(([, v]) => v);
      const lim = rulesOn('r23fAtkMax'); if (lim.length){ const n = Math.min(...lim.map(x => x.n)); if (sel.length > n){ toast(`${lim[0].src}: no more than ${n} creature${n === 1 ? '' : 's'} can attack each combat`); return; } }
      for (const [pid, st] of OPP){ const cs = (st.bf || []).filter(b => b.k && !b.fd && /^no more than (one|two) creatures? can attack you each combat\.?$/im.test(info(b.k)?.o || '')); if (!cs.length) continue; const n = wn((info(cs[0].k).o.match(/no more than (one|two)/i) || [])[1].toLowerCase()) || 2; const at = sel.filter(([, d]) => { const p = parseDef(d); return p && attackTargetProtector(p) === pid; }).length; if (at > n){ toast(`${info(cs[0].k).n}: no more than ${n} creatures can attack ${nameOf(pid)} each combat`); return; } }
    } catch (e){ console.warn(e); }
    const r = da.apply(this, a);
    try { const ids = S.bf.filter(c => c.atk).map(c => c.id); if (ids.length){ if (!S.r23atk || S.r23atk.t !== turnStr()) S.r23atk = {t:turnStr(), ids:[]}; ids.forEach(id => S.r23atk.ids.includes(id) || S.r23atk.ids.push(id)); } } catch {}
    return r; };
  const cb = confirmBlocks;
  confirmBlocks = function(auto, ...a){
    try { const lim = rulesOn('r23fBlkMax'); if (lim.length){ const n = Math.min(...lim.map(x => x.n)); const sel = Object.entries(UI.blkSel || {}).filter(([, v]) => v != null && v !== ''); if (sel.length > n){ if (!auto){ toast(`${lim[0].src}: no more than ${n} creature${n === 1 ? '' : 's'} can block each combat`); return; } sel.slice(n).forEach(([id]) => { UI.blkSel[id] = null; }); } } } catch (e){ console.warn(e); }
    return cb.call(this, auto, ...a); };
}

/* ---------- attack taxes with {W/P} / {X} / while untapped (Norn's Annex, Sphere of Safety, Archangel of Tithes) ---------- */
STATIC_RULES.push(
  [/^creatures can't attack you or planeswalkers you control unless their controller pays \{w\/p\} for each of those creatures$/, m => ({kind:'r23fAtkTax', who:'opp'})],
  [/^creatures can't attack you or planeswalkers you control unless their controller pays \{x\} for each of those creatures, where x is the number of enchantments you control$/, m => ({kind:'r23fAtkTax', who:'opp'})],
  [/^as long as ~ is untapped, creatures can't attack you or planeswalkers you control unless their controller pays \{1\} for each of those creatures$/, m => ({kind:'r23fAtkTax', who:'opp'})],
  [/^as long as ~ is attacking, creatures can't block unless their controller pays \{1\} for each of those creatures$/, m => ({kind:'r23fBlkTax', who:'opp'})],
);
function r23fTaxFor(pid, n){
  const st = OPP.get(pid); if (!st) return {gen:0, phy:''};
  let gen = 0, phy = ''; const why = [];
  const ench = (st.bf || []).filter(e => e.k && !e.fd && /Enchantment/.test(info(e.k)?.t || '')).reduce((a, e) => a + (e.n || 1), 0);
  for (const e of st.bf || []){ if (!e.k || e.fd) continue; const o = tname(info(e.k)?.o || '', info(e.k)?.n).toLowerCase();
    if (/^creatures can't attack you or planeswalkers you control unless their controller pays \{w\/p\} for each of those creatures\.?$/m.test(o)){ phy += '{W/P}'.repeat(n); why.push(`${info(e.k).n}: {W/P} × ${n}`); }
    if (/^creatures can't attack you or planeswalkers you control unless their controller pays \{x\} for each of those creatures, where x is the number of enchantments you control\.?$/m.test(o)){ gen += ench * n; why.push(`${info(e.k).n}: {${ench}} × ${n}`); }
    if (/^as long as ~ is untapped, creatures can't attack you or planeswalkers you control unless their controller pays \{1\} for each of those creatures\.?$/m.test(o) && !e.tap){ gen += n; why.push(`${info(e.k).n}: {1} × ${n}`); }
  }
  return {gen, phy, why};
}
{
  const da = declareAttackers;
  declareAttackers = function(...a){
    try { const pn = phaseNow(); if (pn.mine && S.cb && S.cb.step === 'atk'){
      const per = {}; for (const [id, def] of Object.entries(UI.atkSel || {}).filter(([, v]) => v)){ const c = S.bf.find(x => x.id === +id); const d = parseDef(def); if (!c || !d || !d.pid || d.pid === MYPID) continue; const pid = attackTargetProtector(d) || d.pid; per[pid] = (per[pid] || 0) + (c.n || 1); }
      let gen = 0, phy = ''; const why = []; for (const [pid, n] of Object.entries(per)){ const t = r23fTaxFor(pid, n); gen += t.gen; phy += t.phy; why.push(...t.why); }
      if (gen || phy){ const cost = (gen ? `{${gen}}` : '') + phy; const plan = payPlan(parseCost(cost), S.pool); if (plan.err){ toast(`Attacking costs ${cost} (${why.join(', ')}) — ${plan.err}`); return; } S.pool = plan.pool; if (plan.life){ S.life -= plan.life; } log(`paid ${cost}${plan.life ? ' (' + plan.life + ' life)' : ''} to attack (${why.join(', ')})`); }
    } } catch (e){ console.warn(e); }
    return da.apply(this, a); };
  const cb = confirmBlocks;
  confirmBlocks = function(auto, ...a){
    try { const pn = phaseNow(); if (!pn.mine && pn.pid){ const st = OPP.get(pn.pid); const arch = (st && st.bf || []).filter(e => e.k && !e.fd && e.atk && /^as long as ~ is attacking, creatures can't block unless their controller pays \{1\} for each of those creatures\.?$/im.test(tname(info(e.k)?.o || '', info(e.k)?.n)));
      if (arch.length){ const sel = Object.entries(UI.blkSel || {}).filter(([, v]) => v != null && v !== ''); const n = sel.length * arch.length; if (n){ const plan = payPlan(parseCost(`{${n}}`), S.pool); if (plan.err){ if (!auto){ toast(`Blocking costs {${n}} (${info(arch[0].k).n}) — tap mana first`); return; } sel.forEach(([id]) => { UI.blkSel[id] = null; }); } else { S.pool = plan.pool; log(`paid {${n}} to block (${info(arch[0].k).n})`); } } } } } catch (e){ console.warn(e); }
    return cb.call(this, auto, ...a); };
}

/* ---------- final batch: can't lose, life floor, players' hexproof, Homeward Path, Void Winnower, Archetype, Divine Visitation ---------- */
STATIC_RULES.push(
  [/^your opponents can't block with creatures with even mana values$/, m => ({kind:'r23fNoEvenBlk', who:'opp'})],
  [/^creatures your opponents control lose flying and can't have or gain flying$/, m => ({kind:'r23fNoFly', who:'opp'})],
  [/^if one or more creature tokens would be created under your control, that many 4\/4 white angel creature tokens with flying and vigilance are created instead$/, m => ({kind:'r23fVisit', who:'you'})],
);
function r23fHomeward(){ const mine = S.bf.filter(c => c.own && isCreatureCard(c)); mine.forEach(c => { try { sendBack(c, 'bf'); } catch {} }); if (mine.length) log(`returned ${mine.length} creature${mine.length === 1 ? '' : 's'} to their owners (Homeward Path)`); commit(); }
function r23fFlagOn(key){ const T = turnStr(); if (S && S[key] === T) return true; for (const st of OPP.values()) if (st[key] === T) return true; return false; }
{
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'r23fFlag' && r.d === 'homeward'){ r23fHomeward(); return; } return ao(r, from); };
  const ep = enginePublic;
  enginePublic = function(){ const o = ep(); try { const T = turnStr(); for (const k of ['r23ell', 'r23plHx', 'r23noLose']) if (S[k] === T && (k !== 'r23noLose' || S.r23ell === T)) o[k] = T; } catch {} return o; };
  const se = sanitizeEngine;
  sanitizeEngine = function(s){ const o = se(s); try { for (const k of ['r23ell', 'r23plHx', 'r23noLose']) if (s[k]) o[k] = String(s[k]).slice(0, 20); } catch {} return o; };
  const dm = damageMe;
  damageMe = function(n, f = {}, from){ try { if (S && S.r23floor === turnStr() && n > 0 && !f.inf && S.life - n < 1){ n = Math.max(0, S.life - 1); log("damage reduced: life can't go below 1 this turn"); } } catch {} return dm(n, f, from); };
  // players can't lose life this turn (Everybody Lives!): every client holds its own life at its high-water mark
  const cm = commit;
  commit = function(...a){ try { if (S && r23fFlagOn('r23ell')){ const T = turnStr(); if (!S.r23hw || S.r23hw.t !== T) S.r23hw = {t:T, v:S.life}; if (S.life < S.r23hw.v) S.life = S.r23hw.v; else S.r23hw.v = S.life; } } catch {} return cm.apply(this, a); };
  const sb = sba;
  sba = function(...a){ const r = sb.apply(this, a); try { const T = turnStr(); if (S && S.lost && !S.g23lost && (S.r23noLose === T || [...OPP.values()].some(st => st.r23noLose === T && st.r23ell === T))){ S.lost = ''; } } catch {} return r; };
  const tcd = targetCands;
  targetCands = function(spec, srcx){ const out = tcd(spec, srcx); try { if (r23fFlagOn('r23plHx')) out.forEach(o => { if (o.t === 'player' && o.ok && o.pid !== (srcx && srcx.pid)){ o.ok = false; o.why = 'hexproof'; } }); } catch {} return out; };
  const cbk = canBlock;
  canBlock = function(b, a, apid){ const r = cbk(b, a, apid); if (r) return r; try { if (b && b.k && rulesOn('r23fNoEvenBlk').length && (info(b.k)?.mv || 0) % 2 === 0) return "can't block (even mana value — Void Winnower)"; } catch {} return r; };
  const kw = kwOf;
  kwOf = function(c, k, pid){ if (k === 'flying' && S && c && c.k){ try { const owner = pid || MYPID; if (isCreatureCard(c) && rulesOn('r23fNoFly', owner).length) return false; } catch {} } return kw(c, k, pid); };
  const ct = createToken;
  createToken = function(k, n, near, o){
    try { if (S && !UI.dry && !UI.r23visit && n > 0 && /Creature/.test(info(k)?.t || '') && rulesOn('r23fVisit').length){
      const ak = customToken('Angel', '4/4', 'W'); const d = DICT.get(ak); if (d){ d.t = 'Token Creature — Angel'; d.o = 'Flying, vigilance'; d.kw = ['Flying', 'Vigilance']; }
      UI.r23visit = 1; try { log(`Divine Visitation: ${n} 4/4 Angel token${n === 1 ? '' : 's'} instead`); return ct(ak, n, near, o); } finally { UI.r23visit = 0; } } } catch (e){ console.warn(e); }
    return ct(k, n, near, o); };
}
// High Tide / Bubbling Muck: engine25s's generic "until end of turn, whenever …" delayed trigger would catch this line and add the
// mana only as a trigger on the caster's client (missing auto-pay and other players' taps). Decline it there so the r23tide rule
// above runs: every client adds the extra mana when its own lands of that type are tapped, manually or by auto-pay.
if (typeof r25DelayTry === 'function'){
  const dt = r25DelayTry;
  r25DelayTry = async function(ctx, cond, eff, exp){
    if (/^a player taps an? (?:island|swamp|forest|mountain|plains) for mana$/i.test(String(cond)) && /^(?:target|that) player adds an additional \{[wubrg]\}$/i.test(String(eff))) return false;
    return dt(ctx, cond, eff, exp);
  };
}
