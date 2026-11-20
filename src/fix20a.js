/* =================== fix20a: choosing at the right time (GAPS20 section P, helper P) ===================
   Builds on fix19b (helper M), which moved most targeting to cast / trigger time.
   1. Targets with a group limit are chosen when the spell is cast or the ability triggers, one at a time, and only cards that
      keep the group legal can be added: "total mana value N/X or less" (Rampaging Yao Guai, Ancient Brass Dragon),
      "total power N or less" (Reunion of the House, Nethroi), "different names" (Behold the Sinister Six!),
      "different controllers" (Cloud's Limit Break). Ancient Brass Dragon's "When you do" is a real reflexive trigger: the d20
      is rolled when the first trigger resolves, then a second trigger goes on the stack with its targets (total ≤ the roll).
   2. "For each opponent / each player, … up to one target … card from / in that player's graveyard" targets are chosen per
      player when cast, activated or triggered (Sepulchral Primordial, Diluvian Primordial, Tasha's +1, Afterlife from the
      Loam); resolution uses them (and skips any that left the graveyard) instead of asking.
   3. Modal triggered abilities choose their mode(s) as they are put on the stack (CR 603.3c), then the targets of the chosen
      modes (603.3d), shown on the stack. "Choose one that hasn't been chosen (this turn)" offers only unused modes; "at
      random" picks then. A mode whose targets have no legal choice can't be chosen (700.2a).
   4. Targets in a graveyard written in the plural or with a numeric qualifier ("target creature cards from your graveyard",
      "target permanent card with mana value 3 or less from your graveyard") were read as battlefield targets with no legal
      choice, so nothing happened (Sun Titan, Life from the Loam, Reveillark …): they are now graveyard targets chosen on
      cast / trigger with the qualifier enforced. */
const P20 = {it:null, prev:null};
const P20_WELD = /^Choose target artifact a player controls and target artifact card in that player's graveyard\b/i;
const P20_PER = /\bfor each (opponent|player), (?:you may )?[^.]*?\bup to one target ([a-z ,\/-]+?) card (?:from|in) (?:that|target) player's graveyard/i;
const P20_GRP = [
  // [regex over a sentence (lowercase), build(m) → {base, zone, whose, n, kind, lim}]
  [/^(?:when you do, )?(?:destroy|exile|return|put) any number of target ([a-z ,\/-]+?) with total mana value (x|\d+) or less(?: from (your|a|an opponent's) graveyards?| from graveyards)?\b/, m => ({base:m[1], gy:/ from (?:your |a |an opponent's )?graveyards?/.test(m[0]), whose:m[3] === 'your' ? 'you' : m[3] === "an opponent's" ? 'opp' : 'any', n:99, kind:'mv', lim:m[2]})],
  [/^(?:destroy|exile|return|put) any number of target ([a-z ,\/-]+?) with total power (\d+) or less from your graveyard\b/, m => ({base:m[1], gy:true, whose:'you', n:99, kind:'pow', lim:m[2]})],
  [/^return up to (one|two|three|four|five|six|seven|\d+) target ([a-z ,\/-]+?) with different names from your graveyard\b/, m => ({base:m[2], gy:true, whose:'you', n:wn(m[1]) || +m[1] || 1, kind:'name'})],
  [/^(?:destroy|exile|tap|untap) any number of target ([a-z ,\/-]+?) with different controllers\b/, m => ({base:m[1], gy:false, n:99, kind:'ctl'})],
];
// graveyard targets the stock parser misreads: "<type> card(s) [with mana value / power N or less|greater] from <whose> graveyard"
const P20_GYD = /^((?:another )?(?:[a-z ,\/-]+? )?cards?)(?: with (mana value|power) (\d+) or (less|greater))? (?:from|in) (your|a|an opponent's) graveyard$|^((?:[a-z ,\/-]+? )?cards?)(?: with (mana value|power) (\d+) or (less|greater))? from graveyards$/;
const p20Sent = t => String(t || '').split(/(?<=\.)\s+|\n/).map(x => x.trim()).filter(Boolean);
function p20GrpSpec(sent){
  const l = sent.toLowerCase().replace(/\.$/, '').replace(/^•\s*/, '').replace(/^[a-z' ,!-]{1,40} — (?:(?:\{[^}]+\})+ — )?(?=[a-z])/, ''); if (/^when you do,/.test(l) && !/^when you do, (?:destroy|exile|return|put) any number of target creature cards with total mana value \d+/.test(l)) return null;
  for (const [re, f] of P20_GRP){ const m = l.match(re); if (m){ const g = f(m); const desc = sing(g.base.replace(/ cards?$/, '')) + (g.gy ? ' card' : '');
    return {desc, zone:g.gy ? 'gy' : 'bf', whose:g.whose || 'any', n:g.n, upTo:true, other:false, p20grp:{kind:g.kind, lim:g.lim}}; } }
  return null;
}
function p20PerSpec(sent){
  const m = String(sent || '').match(P20_PER); if (!m || /^when you do\b/i.test(sent)) return null;
  return {desc:m[2].toLowerCase().trim() + ' card', zone:'gy', whose:m[1].toLowerCase() === 'player' ? 'any' : 'opp', n:1, upTo:true, other:false, p20per:m[1].toLowerCase()};
}
// fix a misread graveyard spec (4)
function p20FixGy(sp){
  if (!sp || sp.zone !== 'bf' || sp.any || typeof sp.desc !== 'string') return sp;
  const m = sp.desc.match(P20_GYD); if (!m) return sp;
  const base0 = m[1] || m[6]; const stat = m[2] || m[7]; const num = m[3] || m[8]; const cmp = m[4] || m[9]; const who = m[1] ? m[5] : 'a';
  const other = /^another /.test(base0); const base = sing(base0.replace(/^another /, '').replace(/(?:^| )cards?$/, '')).trim();
  if (/\b(that|exiled|chosen|named|single|battlefield|from|into)\b/.test(base)) return sp;
  return {...sp, desc:(base ? base + ' ' : '') + 'card', zone:'gy', whose:who === 'your' ? 'you' : who === "an opponent's" ? 'opp' : 'any', other:other || sp.other, p20q:stat ? {stat, n:+num, cmp} : null};
}
{
  const ts = targetSpecs;
  targetSpecs = function(t, ...a){
    try {
      const txt = String(t || '');
      if (P20_WELD.test(txt)) return [{desc:'artifact', zone:'bf', n:1, upTo:false, other:false}, {desc:'artifact card', zone:'gy', whose:'any', n:1, upTo:false, other:false, p20same:1}];
      if (P20_PER.test(txt) || /\bwith (?:total (?:mana value|power)|different (?:names|controllers))\b/i.test(txt)){
        const out = [];
        for (const s of p20Sent(txt)){
          const sp = p20PerSpec(s) || p20GrpSpec(s);
          if (sp){ out.push(sp); continue; }
          if (/^when you do, put any number of target creature cards with total mana value x or less from graveyards/i.test(s)) continue;
          out.push(...ts.call(this, s, ...a).map(p20FixGy));
        }
        return out;
      }
      return ts.call(this, t, ...a).map(p20FixGy);
    } catch (e){ console.warn('p20 specs', e); return ts.call(this, t, ...a); }
  };
  // graveyard candidates: qualifier and "another"
  const tc = targetCands;
  targetCands = function(spec, src){
    let out = tc(spec, src);
    try { if (spec && spec.zone === 'gy' && Array.isArray(out)){
      if (spec.p20q){ const q = spec.p20q; out = out.filter(c => { const a = info(c.k) || {}; const v = q.stat === 'power' ? (parseInt(a.p) || 0) : (a.mv || 0); return q.cmp === 'less' ? v <= q.n : v >= q.n; }); }
      if (spec.other && src && src.id != null) out = out.filter(c => !(c.pid === MYPID && c.id === src.id));
    } } catch (e){ console.warn('p20 cands', e); }
    return out;
  };
}
const p20Pow = c => { try { if (c.t === 'card'){ const b = boardOf(c.pid).find(x => x.id === c.id); const st = b && (c.pid === MYPID ? stats(b) : statsAny(c)); if (st) return Math.max(0, st[0] || 0); } } catch {} return parseInt(info(c.k)?.p) || 0; };
function p20Lim(lim){
  if (lim == null) return Infinity; if (lim !== 'x') return +lim;
  const it = P20.it; let x = it ? (it.x || it.evX) : null;
  if (!(x > 0) && it && it.srcId != null){ const c = S.bf.find(b => b.id === it.srcId); if (c && (c.cp || 0) > 0 && /enters with x \+1\/\+1 counters/i.test(info(c.k)?.o || '')) x = c.cp; }
  if (!(x > 0) && UI.casting && UI.lastX != null) x = UI.lastX;
  return x > 0 ? x : 0;
}
function p20GroupOk(kind, lim, cs){
  if (kind === 'mv') return cs.reduce((a, c) => a + (info(c.k)?.mv || 0), 0) <= lim;
  if (kind === 'pow') return cs.reduce((a, c) => a + p20Pow(c), 0) <= lim;
  if (kind === 'name') return new Set(cs.map(c => info(c.k)?.n)).size === cs.length;
  if (kind === 'ctl') return new Set(cs.map(c => c.pid)).size === cs.length;
  return true;
}
const p20Where = c => c.t === 'gy' ? (c.pid === MYPID ? ' (your graveyard)' : ` (${nameOf(c.pid)}'s graveyard)`) : c.pid === MYPID ? '' : ` (${nameOf(c.pid)})`;
// one card at a time, each time only from those that keep the group legal
async function p20PickGroup(title, hint, legal, n, okWith){
  const chosen = [];
  while (chosen.length < n){
    const left = legal.filter(c => !chosen.includes(c) && okWith(chosen.concat(c))); if (!left.length) break;
    const cards = left.map((c, i) => ({id:-7000 - i, k:c.k, tap:false}));
    const ids = await pickCards({title:`${title}${chosen.length ? ` — chosen: ${chosen.map(c => c.nm + p20Where(c)).join(', ')}` : ''}`, hint, cards, min:0, max:1, noneLabel:chosen.length ? 'Done' : 'None'});
    const i = ids && ids[0] != null ? -7000 - ids[0] : -1; if (i < 0 || !left[i]) break; chosen.push(left[i]);
  }
  return chosen;
}
{
  const pt = pickTargets;
  pickTargets = function(spec, src, title){
    if (spec && spec.p20same && !UI.dry){
      const pid = P20.prev && P20.prev[0] && P20.prev[0].pid; const name = String(title || '').split(':')[0];
      const cands = targetCands({...spec, p20same:0}, src).filter(c => c.ok && c.pid === pid); if (!cands.length) return Promise.resolve([]);
      return pickCards({title:`${name}: choose target ${spec.desc} in ${pid === MYPID ? 'your' : nameOf(pid) + "'s"} graveyard`, cards:cands.map((c, i) => ({id:-7000 - i, k:c.k})), min:1, max:1}).then(ids => { const i = ids && ids[0] != null ? -7000 - ids[0] : -1; return cands[i] ? [cands[i]] : null; });
    }
    if (!spec || !(spec.p20per || spec.p20grp) || UI.dry) return pt(spec, src, title).then(r => { P20.prev = r; return r; });
    if (typeof q24Slaved === 'function' && q24Slaved()) return pt(spec, src, title);
    return (async () => {
      const name = String(title || '').split(':')[0];
      if (spec.p20per){
        const out = []; const ps = (spec.p20per === 'player' ? players() : opponents()).filter(p => !(p.s && p.s.lost));
        for (const p of ps){
          const cands = targetCands({...spec, whose:p.me ? 'you' : 'opp', p20per:null}, src).filter(c => c.ok && c.pid === p.pid); if (!cands.length) continue;
          const ids = await pickCards({title:`${name}: choose up to one target ${spec.desc} in ${p.me ? 'your' : p.nm + "'s"} graveyard`, cards:cands.map((c, i) => ({id:-7000 - i, k:c.k})), min:0, max:1, noneLabel:'None'});
          const i = ids && ids[0] != null ? -7000 - ids[0] : -1; if (cands[i]) out.push(cands[i]);
        }
        return out;
      }
      const g = spec.p20grp; const lim = p20Lim(g.lim);
      const legal = targetCands({...spec, p20grp:null}, src).filter(c => c.ok);
      const what = g.kind === 'mv' ? `total mana value ${lim} or less` : g.kind === 'pow' ? `total power ${lim} or less` : g.kind === 'name' ? 'different names' : 'different controllers';
      return p20PickGroup(`${name}: choose ${spec.n < 99 ? 'up to ' + spec.n : 'any number of'} target ${spec.desc}s with ${what}`, g.kind === 'mv' || g.kind === 'pow' ? `Only cards that keep the total at ${lim} or less can be added.` : '', legal, spec.n, cs => p20GroupOk(g.kind, lim, cs));
    })();
  };
}
// the stack item whose choices are being made (for X)
{
  const mh = m19Hold;
  m19Hold = function(it, fn){ return mh(it, async (x) => { const sv = P20.it; P20.it = x || it; try { return await fn(x); } finally { P20.it = sv; } }); };
}

/* =============== 3. modal triggered abilities: modes on the stack =============== */
const P20_MODEHEAD = /(^|\n)([^\n]*?)\bchoose (one or both|one or more|up to one|up to two|up to three|any number|one|two|three)\b([^\n—]*)—\s*\n\s*•/i;
function p20ModalSpec(txt){
  const t = String(txt || ''); const md = parseModes(t); if (!md) return null; const h = t.match(P20_MODEHEAD); if (!h) return null;
  if (/\bwhen(?:ever)? you do\b/i.test(t) || /\b(opponent|that player|target player|each player|any player)\b/i.test(h[2])) return null;
  return {md, random:/\bat random\b/i.test(h[4]), unused:/\bthat hasn't been chosen\b/i.test(h[4]) ? (/this turn/i.test(h[4]) ? 'turn' : 'ever') : null};
}
function p20UsedKey(it){ return `${it.k}|${it.srcId ?? ''}`; }
async function p20ChooseModes(it, ms){
  const {md} = ms; const name = it.nm; const key = p20UsedKey(it); S.p20used = S.p20used || {};
  const rec = S.p20used[key]; const used = rec && (ms.unused === 'ever' || rec.t === turnStr()) ? rec.idx : [];
  const src = {pid:MYPID, col:info(it.k)?.c, types:info(it.k)?.t, id:it.srcId};
  const legal = md.opts.map((o, i) => !used.includes(i) && !(ms.unused && used.includes(i)) && !targetsAvailable(o, src));
  const avail = md.opts.map((o, i) => i).filter(i => legal[i]);
  let idx;
  if (!avail.length) idx = [];
  else if (ms.random){ const n = Math.min(Math.max(md.min, 1), avail.length); const pool = avail.slice(); idx = []; while (idx.length < n && pool.length) idx.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); idx.sort((a, b) => a - b); log(`${name}: mode chosen at random — “${short(md.opts[idx[0]], 60)}”`); }
  else {
    const max = Math.min(md.max, avail.length), min = Math.min(md.min, avail.length); idx = [];
    while (idx.length < max){
      const opts = md.opts.map((o, i) => ({label:o.replace(/~/g, name), value:i, disabled:!legal[i] || idx.includes(i)}));
      if (idx.length >= min) opts.push({label:idx.length ? 'That’s all' : 'Choose nothing', value:'done'});
      const v = await askChoice({title:`${name}: choose ${max === 1 ? 'one' : (min === max ? max : (min ? min + ' to ' : 'up to ') + max)}${max > 1 ? ` (${idx.length} chosen)` : ''} — the mode is chosen as the ability goes on the stack`, options:opts});
      if (v === 'done') break;
      if (v == null || !legal[v] || idx.includes(+v)){ if (idx.length >= min) break; const d = avail.find(i => !idx.includes(i)); if (d == null) break; idx.push(d); continue; }
      idx.push(+v);
    }
    idx.sort((a, b) => a - b);
  }
  if (ms.unused && idx.length){ const r = S.p20used[key] && (ms.unused === 'ever' || S.p20used[key].t === turnStr()) ? S.p20used[key] : {t:turnStr(), idx:[]}; r.idx = r.idx.concat(idx); S.p20used[key] = r; }
  return idx;
}
{
  const et = m19EarlyTrig;
  m19EarlyTrig = function(it){
    const r = et(it);
    try {
      if (it && !it.m19wait && !it.hold && !Array.isArray(it.modes) && !it.tgts && !M19_BALOR.test(String(it.txt || ''))){
        const ms = p20ModalSpec(it.txt);
        if (ms) return m19Hold(it, async () => {
          const idx = await p20ChooseModes(it, ms); it.modes = idx;
          const mtxt = modeText(ms.md, idx); let t = [];
          if (idx.length && targetSpecs(mtxt).length){ t = await chooseTargets(mtxt, {pid:MYPID, col:info(it.k)?.c, types:info(it.k)?.t, id:it.srcId}, it.nm); if (t == null) t = targetSpecs(mtxt).map(() => []); }
          it.tgts = t;
          if (t.flat().length && !(await payWard(t, it.nm))){ log(`${it.nm}: countered by ward`); return 'remove'; }
          const ml = idx.length ? idx.map(i => short(ms.md.opts[i].replace(/~/g, it.nm), 40)).join(' + ') : 'no mode';
          it.tgtNm = m19Label([ml, tgtLabel(t)]); log(`${it.nm}: chose ${ml}${t.flat().length ? ' targeting ' + tgtLabel(t) : ''}`);
        });
      }
    } catch (e){ console.warn('p20 modal', e); }
    return r;
  };
}

/* =============== resolution: use what was chosen =============== */
const p20Chosen = ctx => { const it = ctx && ctx.it; return it && Array.isArray(it.tgts) ? it.tgts.flat().filter(t => t && t.t === 'gy') : null; };
function p20Live(list, name){ return list.filter(t => { if (targetStillThere(t)) return true; log(`${name}: ${t.nm} is no longer in the graveyard — not a legal target`); return false; }); }
async function p20Pre(s, l, ctx){
  let m; const it = ctx.it || {}; const name = ctx.name;
  // 1. Ancient Brass Dragon: the roll is made, then "When you do" goes on the stack with its targets
  if ((m = l.match(/^(?:when you do, )?put any number of target creature cards with total mana value x or less from graveyards onto the battlefield under your control, where x is the result$/)) && !UI.dry && !it.p20abd && ctx.roll > 0){
    const x = ctx.roll || 0; if (!(x > 0)) return true;
    const txt = `Put any number of target creature cards with total mana value ${x} or less from graveyards onto the battlefield under your control.`;
    const tgts = (await chooseTargets(txt, {pid:MYPID, col:info(ctx.k)?.c, types:info(ctx.k)?.t, id:it.srcId}, name)) || [[]];
    const t2 = pushTrig(name, txt, {k:ctx.k, srcId:it.srcId, p20abd:{x}, tgts, tgtNm:tgtLabel(tgts).slice(0, 118) || 'no targets', x});
    log(`${name}: reflexive trigger (rolled ${x}) → ${t2.tgtNm}`); commit(); return true;
  }
  if (it.p20abd && /^put any number of target creature cards with total mana value \d+ or less from graveyards onto the battlefield under your control$/.test(l)){
    if (UI.dry) return true; const got = p20Live(p20Chosen(ctx) || [], name);
    for (const t of got) u25takeGy(t, name); if (!got.length) log(`${name}: no card was put onto the battlefield`); commit(); return true;
  }
  // a target card in an opponent's graveyard put onto the battlefield under my control (Junji, Staff of Eden …): it was a do-by-hand box
  if ((m = l.match(/^(?:put|return) target (.+?) card from (?:a|any) graveyard (?:onto|to) the battlefield under your control$/)) && !UI.dry && ctx.tgts){
    const t = nextTargets(ctx)[0]; if (!t){ log(`${name}: no target`); return true; }
    if (t.t === 'gy' && !targetStillThere(t)){ log(`${name}: ${t.nm} is no longer in the graveyard`); return true; }
    if (t.pid === MYPID){ if (find(t.id)[0] === 'gy') moveCard(t.id, 'bf'); } else u25takeGy(t, name);
    ctx.lastT = [t]; commit(); return true;
  }
  // Goblin Welder: both targets were chosen on activation (the graveyard card from that player's graveyard)
  if (l === 'a26 welder' && !UI.dry && ctx.tgts){
    const all = ctx.tgts.flat().filter(Boolean); const art = all.find(t => t.t === 'card'); const g = all.find(t => t.t === 'gy');
    if (art && g){
      if (art.pid !== g.pid || !targetStillThere(art) || !targetStillThere(g)){ log(`${name}: a target is no longer legal — nothing happens`); return true; }
      if (art.pid === MYPID) a26Weld(art.id, g.id, name); else { sendRq(art.pid, 'p20weld', 0, name, {tid:art.id, d:g.k}); log(`${nameOf(art.pid)} sacrifices ${art.nm} and returns ${g.nm} from their graveyard (${name})`); }
      commit(); return true;
    }
  }
  // 4. several targets chosen together from my graveyard (one group): older handlers took only the first of the group
  if ((m = l.match(/^(?:you may )?return (?:up to (?:one|two|three|four|five|six|x|\d+) |x |one or two )?target ((?:[a-z ,\/-]+? )?cards?)(?: with (?:mana value|power) \d+ or less)? from your graveyard to (your hand|the battlefield)( tapped)?$/)) && !UI.dry && ctx.tgts){
    const g = ctx.tgts[ctx.ti || 0] || [];
    if (g.length > 1 && g.every(t => t.t === 'gy' && t.pid === MYPID)){
      const live = nextTargets(ctx); const moved = [];
      for (const t of live){ const c = S.gy.find(x => x.id === t.id); if (!c) continue; moveCard(c.id, m[2] === 'your hand' ? 'hand' : 'bf', {quiet:true}); if (m[3]){ const b = S.bf.find(x => x.id === c.id); if (b) b.tap = true; } moved.push(cname(c)); }
      log(`${name}: returned ${moved.join(', ') || 'nothing'} to ${m[2] === 'your hand' ? 'hand' : 'the battlefield'}`); commit(); return true;
    }
  }
  // 2. per-player graveyard targets chosen earlier
  const ch = p20Chosen(ctx); if (!ch || UI.dry) return false;
  if (/^for each opponent, you may put up to one target creature card from (?:that|target) player's graveyard onto the battlefield under your control$/.test(l)){
    const got = p20Live(ch, name); for (const t of got) u25takeGy(t, name); if (!got.length) log(`${name}: no card chosen`); commit(); return true;
  }
  if ((m = l.match(/^for each opponent, exile up to one target (instant or sorcery|creature|artifact|noncreature) card from that player's graveyard and put an? (page|stash|hit) counter on it$/))){
    const got = p20Live(ch, name); const seen = new Set();
    for (const t of got){ if (t.pid === MYPID || seen.has(t.pid)) continue; seen.add(t.pid); await zExileGyCard(t.pid, t.k, ctx, {ctr:m[2]}); }
    if (!got.length) log(`${name}: no card chosen`); commit(); return true;
  }
  if ((m = l.match(/^for each opponent, (?:you may )?cast (?:up to one )?target (nonland permanent|instant or sorcery|creature|instant|sorcery|artifact) card from (?:that|target) player's graveyard( without paying its mana cost)?(?:, and mana of any type can be spent to cast that spell)?$/))){
    ctx.r21 = true; const got = p20Live(ch, name);
    const exAfter = /if a spell cast this way would be put into a graveyard, exile it instead/.test(String(ctx.full || zText(ctx)).toLowerCase());
    for (const t of got){ if (!t.pid || t.pid === MYPID) continue;
      const res = await r21Ask(t.pid, 'r21gyLend', 0, name, {d:t.k});
      res.ids.forEach(id => { const c = S.ex.find(x => x.id === id); if (c && exAfter) c.r21exAfter = 1; });
      await r21CastNow({...ctx, r21ids:res.ids}, {free:!!m[2], max:1, any:/mana of any type/.test(l)});
      res.ids.map(id => S.ex.find(c => c.id === id)).filter(Boolean).forEach(c => r21Drop(c, ''));
    }
    if (!got.length) log(`${name}: no card chosen`); commit(); return true;
  }
  if (/^for each player, choose up to one target creature card in (?:that|target) player's graveyard$/.test(l)){
    ctx.h23loam = p20Live(ch, name).map(t => ({pid:t.pid, id:t.pid === MYPID ? t.id : null, k:t.k})); return true;
  }
  return false;
}
{ const ds = doSentence; doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && ctx && await p20Pre(s, l, ctx)) return; return ds(s0, ctx); }; }
RQ_OPS.push('p20weld');
{ const ao = applyOp; applyOp = function(r, from){ if (r && r.op === 'p20weld'){ const g = S.gy.find(c => c.k === r.d); if (!g){ log(`${r.src}: a target is no longer legal — nothing happens`); commit(); return; } a26Weld(r.tid, g.id, r.src); return; } return ao(r, from); }; }
