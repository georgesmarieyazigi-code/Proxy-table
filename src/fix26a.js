/* ===== fix26a: bug-hunt fixes (13 Nov 2026) ===== */
// Foray of Orcs and friends: "where X is the amassed Army's power" asked the player for a number.
{ const co = countOf; countOf = function(phrase, ctx){
    try { if (/^the amassed army's power\.?$/i.test(String(phrase).trim())){ const army = S.bf.find(c => /\bArmy\b/.test(typeOf(c)) && !c.fd); return army ? Math.max(0, (stats(army) || [0])[0]) : 0; } } catch (e){ console.warn('f26 army', e); }
    return co.apply(this, arguments); }; }
// Pack Leader: "prevent all combat damage that would be dealt this turn to Dogs you control" was left to do by hand.
{ const ds = doSentence; doSentence = async function(s0, ctx){
    try { const l = String(s0).replace(/\.$/, '').trim().toLowerCase();
      let m = l.match(/^prevent all combat damage that would be dealt this turn to (\w+?)s you control$/);
      if (m && ctx){ (S.f26fog ||= []).push({t:p24T(), type:m[1]}); log(`${ctx.name || 'It'}: combat damage to ${m[1]}s you control is prevented this turn`); commit(); return; }
    } catch (e){ console.warn('f26 sentence', e); }
    return ds.apply(this, arguments); }; }
{ const dc = damageCard; damageCard = function(c, n, f = {}){
    try { if (S && c && n > 0 && f && f.p24c && S.f26fog && S.bf.includes(c) && isCreatureCard(c)){ const T = p24T(); S.f26fog = S.f26fog.filter(x => x.t === T);
        const hit = S.f26fog.find(x => new RegExp('\\b' + x.type + '\\b', 'i').test(typeOf(c))); if (hit){ log(`combat damage to ${cname(c)} prevented`); return 0; } } } catch (e){ console.warn('f26 fog', e); }
    return dc.apply(this, arguments); }; }
// A token split off a stack (to be targeted or sacrificed) came out untapped and without its counters even when every
// token in the stack was tapped / had counters: tapping three Soldiers, then pumping one, untapped it.
{ const sg = single; single = function(c){
    const n0 = (c && c.n) || 1, t0 = (c && c.tn) || 0; const s = sg.apply(this, arguments);
    try { if (s && s !== c){ if (t0 >= n0){ s.tap = true; c.tn = Math.min(t0 - 1, c.n); }
        for (const f of ['cp', 'cm', 'co']) if (c[f]) s[f] = c[f]; if (c.nc) s.nc = {...c.nc}; if (c.ekw) s.ekw = [...c.ekw]; if (c.pu) s.pu = [...c.pu]; commit(); } } catch (e){ console.warn('f26 single', e); }
    return s; }; }
// Triggers that go on the stack together (nothing resolved in between) are ordered by their controller (CR 603.3b).
// Default order: a trigger that creates tokens resolves before one that targets (Blowfly Infestation + Nest of Scarabs /
// Flourishing Defenses: the token must exist before Blowfly picks its target).
{ const pt = pushTrigger; pushTrigger = function(){
    const n0 = S.stk.length; const r = pt.apply(this, arguments);
    try { if (S.stk.length > n0 && typeof F25 !== 'undefined'){ const it = S.stk[S.stk.length - 1]; if (it.kind === 'trigger' && it.rn === undefined) it.rn = F25.resN;
        const batch = S.stk.filter(x => x.kind === 'trigger' && x.rn === F25.resN); if (batch.length > 1){
          const sc = x => { const t = String(x.txt || x.eff || ''); return /\bcreates?\b[^.]*\btokens?\b/i.test(t) ? 1 : /\btarget\b/i.test(t) ? -1 : 0; };
          if (new Set(batch.map(sc)).size > 1){ const os = batch.map(x => x.o).sort((a, b) => a - b); const byO = batch.slice().sort((a, b) => a.o - b.o);
            const wasTop = byO[byO.length - 1]; const ord = byO.map((x, i) => [x, i]).sort((a, b) => sc(a[0]) - sc(b[0]) || a[1] - b[1]).map(z => z[0]);
            ord.forEach((x, i) => x.o = os[i]); const top = ord[ord.length - 1];
            if (top !== wasTop){ if (S.pass === 's:' + wasTop.sid) S.pass = 's:' + top.sid; log(`ordered triggers: ${top.nm} resolves first`); } commit(); } } } } catch (e){ console.warn('f26 order', e); }
    return r; }; }
