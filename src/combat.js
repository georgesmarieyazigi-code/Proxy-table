
/* =============================================================
   Rules engine — round 3: combat
   Steps inside the combat phase (S.cb.step):
     begin → (window) → atk: active player declares attackers →
     atkd (window) → blk: every attacked player declares blockers at
     the same time (1 minute) → blkd (window) → fs: first-strike
     damage (only if needed) → dmg: regular damage → end → Main 2.
   Attackers carry c.atk = "p:<pid>" (a player) or "c:<pid>:<id>" (a
   planeswalker or battle). Blockers carry c.blk = attacker id. Each
   player deals the damage of their own creatures; the owner applies
   damage to their own things.
   ============================================================= */
const CB_WIN = ['begin', 'atkd', 'blkd'];
UI.atkSel = {}; UI.blkSel = {};

function cbOf(pn){ const st = pn.pid === MYPID ? S : OPP.get(pn.pid); const cb = st && st.cb; return cb && cb.t === `${pn.g}.${pn.n}` ? cb : null; }
const cbKey = (pn, cb) => `${pn.g}.${pn.n}.${cb.n}`;
function parseDef(s){ if (!s) return null; const p = s.split(':'); return p[0] === 'p' ? {t:'player', pid:p[1]} : {t:'card', pid:p[1], id:+p[2]}; }
function defLabel(s){ const d = parseDef(s); if (!d) return ''; if (d.t === 'player') return d.pid === MYPID ? 'you' : nameOf(d.pid); const c = boardOf(d.pid).find(x => x.id === d.id); return `${d.pid === MYPID ? 'your' : nameOf(d.pid) + "'s"} ${c ? info(c.k)?.n : 'permanent'}`; }
function defOpts(){
  const out = [];
  for (const p of opponents()){
    if (p.s && p.s.lost) continue;
    out.push({key:'p:' + p.pid, label:p.nm, pid:p.pid});
    (p.s?.bf || []).forEach(c => { if (c.k && !c.fd && /\bPlaneswalker\b/.test(info(c.k)?.t || '')) out.push({key:`c:${p.pid}:${c.id}`, label:`${p.nm}'s ${info(c.k)?.n}`, pid:p.pid}); });
  }
  for (const b of boardsAll()) b.bf.forEach(c => { if (c.k && !c.fd && c.prot && c.prot !== MYPID && /\bBattle\b/.test(info(c.k)?.t || '')) out.push({key:`c:${b.pid}:${c.id}`, label:`${b.pid === MYPID ? 'my' : nameOf(b.pid) + "'s"} ${info(c.k)?.n} (battle)`, pid:b.pid}); });
  return out;
}
function canAttack(c){
  if (!isCreatureCard(c) || c.fd) return 'not a creature';
  if (c.tap || (c.tn || 0) > 0) return 'tapped';
  if (c.sk && hasHaste(c) === false) return 'summoning sick';
  if (kwOf(c, 'defender')) return 'defender';
  if (/~ can't attack/i.test(tname(textOf(c), cname(c)))) return "can't attack";
  if (attachFx(c, MYPID).noAtk) return `can't attack (${attachFx(c, MYPID).names.join(', ')})`;
  return '';
}
const mustAttack = c => /attacks each combat if able/i.test(tname(textOf(c), cname(c))) || goadOn(c);
function canBlock(b, a, apid){
  if (!isCreatureCard(b) || b.fd) return 'not a creature';
  if (b.tap) return 'tapped';
  if (/~ can't block/i.test(tname(textOf(b), cname(b)))) return "can't block";
  if (attachFx(b, MYPID).noBlk) return `can't block (${attachFx(b, MYPID).names.join(', ')})`;
  const at = tname(textOf(a), info(a.k)?.n || '').toLowerCase(); const ac = info(a.k)?.c || ''; const bc = info(b.k)?.c || '';
  if (/(^|\n|\. )~ can't be blocked(\.|$| this turn)/m.test(at)) return "can't be blocked";
  if (kwOf(a, 'flying', apid) && !kwOf(b, 'flying') && !kwOf(b, 'reach')) return 'flying';
  if (kwOf(a, 'shadow', apid)) return 'shadow';
  if (kwOf(a, 'horsemanship', apid) && !kwOf(b, 'horsemanship')) return 'horsemanship';
  if (kwOf(a, 'intimidate', apid) && !/Artifact/.test(typeOf(b)) && ![...ac].some(x => bc.includes(x))) return 'intimidate';
  if (kwOf(a, 'fear', apid) && !/Artifact/.test(typeOf(b)) && !bc.includes('B')) return 'fear';
  const lw = at.match(/^(?:[a-z ]+, )*(plains|island|swamp|mountain|forest)walk/m);
  if (lw && S.bf.some(l => new RegExp('\\b' + lw[1] + '\\b', 'i').test(typeOf(l)))) return lw[1] + 'walk';
  if (protects(a, {col:bc, types:typeOf(b)})) return 'protection';
  if (/~ can't be blocked by (creatures with power (\d+) or less)/.test(at)){ const n = +RegExp.$2; const st = stats(b); if (st && st[0] <= n) return `power ${n} or less`; }
  return '';
}
const hasMenace = (a, apid) => kwOf(a, 'menace', apid) || /can't be blocked except by two or more/i.test(textOf(a));

/* ---------- Flow (active player) ---------- */
function startCombat(){
  const ts = turnStr(); const n = (S.cb && S.cb.t === ts ? S.cb.n : 0) + 1;
  S.cb = {t:ts, n, step:'begin'}; UI.atkSel = {};
}
function setStep(step){ if (!S.cb) return; S.cb.step = step; S.cb.at = Date.now(); if (step === 'atkd' || step === 'blkd') S.pass = prioKey(); commit(); }
function attackedPids(){ const set = new Set(); S.bf.forEach(c => { const d = parseDef(c.atk); if (d) set.add(attackTargetProtector(d)); }); return [...set]; }
function advanceCombat(){
  const pn = phaseNow(); const cb = S.cb; if (!pn.mine || !cb || UI.cbBusy) return;
  if (cb.step === 'begin'){
    const can = S.bf.filter(c => !canAttack(c));
    if (!can.length || !defOpts().length){ log(can.length ? 'nobody to attack' : 'no creatures can attack'); endCombat(); return; }
    UI.atkSel = {}; can.filter(mustAttack).forEach(c => { UI.atkSel[c.id] = defOpts()[0].key; });
    setStep('atk'); return;
  }
  if (cb.step === 'atkd'){ if (!S.bf.some(c => c.atk)){ endCombat(); return; } setStep('blk'); return; }
  if (cb.step === 'blkd'){ runDamage(); return; }
}
function blockersFor(){ // attacker id -> [{pid, id, k}]
  const m = new Map();
  for (const [pid, s] of OPP) (s.bf || []).forEach(b => { if (b.blk != null && b.k){ if (!m.has(b.blk)) m.set(b.blk, []); m.get(b.blk).push({t:'card', pid, id:b.id, k:b.k, nm:info(b.k)?.n, c:b}); } });
  return m;
}
const isFS = (c, pid) => kwOf(c, 'first strike', pid) || kwOf(c, 'double strike', pid);
async function runDamage(){
  UI.cbBusy = true;
  try {
    const bl = blockersFor();
    const anyFS = S.bf.some(c => c.atk && isFS(c, MYPID)) || [...bl.values()].flat().some(b => isFS(b.c, b.pid));
    if (anyFS){ setStep('fs'); await attackerDamage('fs', bl); await sleep(1500); }
    setStep('dmg'); await attackerDamage('dmg', blockersFor()); await sleep(1200);
    endCombat();
  } finally { UI.cbBusy = false; }
}
function endCombat(){
  S.bf.forEach(c => { c.atk = ''; });
  if (S.cb) S.cb.step = 'end';
  log('combat ends'); setPhase(5);
}
async function attackerDamage(step, blocks){
  for (const a of S.bf.filter(c => c.atk)){
    const fs = isFS(a, MYPID), ds = kwOf(a, 'double strike');
    if (step === 'fs' && !fs) continue; if (step === 'dmg' && fs && !ds) continue;
    const st = stats(a); if (!st) continue; const pow = Math.max(0, st[0]); if (!pow) continue;
    const def = parseDef(a.atk); const extra = a.cmd ? {cmd:a.k} : {};
    const all = blocks.get(a.id) || []; const live = all.filter(b => targetStillThere(b));
    const cnt = a.n || 1;
    if (cnt > 1){ live.forEach(b => dealDamage(b, pow, a.k, a)); const unb = cnt - all.length; if (unb > 0) hitDefender(def, pow * unb, a, extra); continue; }
    if (!all.length){ hitDefender(def, pow, a, extra); continue; }
    if (!live.length){ if (kwOf(a, 'trample')) hitDefender(def, pow, a, extra); continue; }
    let plan = defaultAssign(a, live, pow);
    if (live.length > 1 || (kwOf(a, 'trample') && plan.rest > 0 && false)) plan = await splitDamage(a, live, pow, plan);
    plan.to.forEach(([b, n]) => dealDamage(b, n, a.k, a));
    if (plan.rest > 0 && kwOf(a, 'trample')) hitDefender(def, plan.rest, a, extra);
  }
  commit();
}
function lethalFor(b, src){ const st = statsAny(b) || [0, 1]; const dmg = (b.c && b.c.dmg) || 0; return kwOf(src, 'deathtouch') ? 1 : Math.max(1, st[1] - dmg); }
function defaultAssign(a, bl, pow){
  let left = pow; const to = [];
  bl.forEach((b, i) => { const need = lethalFor(b, a); const n = i === bl.length - 1 && !kwOf(a, 'trample') ? left : Math.min(left, need); to.push([b, n]); left -= n; });
  return {to, rest:left};
}
function hitDefender(def, n, a, extra){
  if (!def || n <= 0) return;
  if (def.t === 'player'){ if (def.pid === MYPID) return; dealDamage({t:'player', pid:def.pid}, n, a.k, a, extra); emit({type:'cdmg', k:a.k, id:a.id, dp:def.pid, cnt:1, amt:n}); r7CombatHit(def.pid); }
  else if (targetStillThere({t:'card', pid:def.pid, id:def.id, k:boardOf(def.pid).find(x => x.id === def.id)?.k})) dealDamage({t:'card', pid:def.pid, id:def.id}, n, a.k, a, extra);
}
function splitDamage(a, bl, pow, plan){
  return new Promise(res => openModal({type:'split', key:rid(4), a, bl, pow, plan:{to:plan.to.map(x => [x[0], x[1]]), rest:plan.rest}, trample:kwOf(a, 'trample'), resolve:res, noClose:true}));
}
/* ---------- Defenders: their blockers deal damage when they see the step ---------- */
function defenderTick(pn){
  const cb = cbOf(pn); if (!cb || pn.mine) return;
  const key = cbKey(pn, cb);
  if (cb.step === 'atk' || cb.step === 'begin'){ if (S.bd && !S.bd.startsWith(key)) { S.bd = ''; } }
  if ((cb.step === 'fs' || cb.step === 'dmg') && S.dd !== key + cb.step){
    S.dd = key + cb.step;
    for (const b of S.bf.filter(c => c.blk != null)){
      const fs = isFS(b, MYPID), ds = kwOf(b, 'double strike');
      if (cb.step === 'fs' && !fs) continue; if (cb.step === 'dmg' && fs && !ds) continue;
      const att = boardOf(pn.pid).find(x => x.id === b.blk); if (!att) continue;
      const st = stats(b); if (!st || st[0] <= 0) continue;
      dealDamage({t:'card', pid:pn.pid, id:att.id, k:att.k}, st[0], b.k, b);
    }
    commit();
  }
  if (cb.step === 'end' && S.bf.some(c => c.blk != null)){ S.bf.forEach(c => { c.blk = null; }); commit(); }
}
function attackersOnMe(pn){ return (OPP.get(pn.pid)?.bf || []).filter(c => { const d = parseDef(c.atk); return d && attackTargetProtector(d) === MYPID; }); }
function blocksDone(pn){
  const cb = S.cb; const key = cbKey(pn, cb);
  return attackedPids().every(pid => pid === MYPID || !isLive(pid) || (OPP.get(pid)?.bd || '') === key || ((OPP.get(pid)?.v || 0) < 3));
}
function combatTick(){
  const pn = phaseNow(); if (pn.n === 0 || pn.ph !== 4) { if (S.bf.some(c => c.blk != null) && pn.ph !== 4){ S.bf.forEach(c => { c.blk = null; }); } return; }
  if (!pn.mine){ defenderTick(pn); maybeAutoBlock(pn); return; }
  if (!S.cb || S.cb.t !== `${pn.g}.${pn.n}`) return;
  if (S.cb.step === 'blk' && blocksDone(pn)){ const bl = blockersFor(); bl.forEach((list, aid) => { const a = S.bf.find(c => c.id === aid); if (a){ log(`${cname(a)} is blocked by ${list.map(b => b.nm).join(' and ')}`); if (list.length) emit({type:'blocked', k:a.k, id:a.id}); } }); setStep('blkd'); }
}
function maybeAutoBlock(pn){
  const cb = cbOf(pn); if (!cb || cb.step !== 'blk') { UI.blkT = null; return; }
  const key = cbKey(pn, cb); if ((S.bd || '') === key) return;
  if (!attackersOnMe(pn).length){ S.bd = key; commit(); return; }
  if (!UI.blkT || UI.blkT.key !== key) UI.blkT = {key, until:Date.now() + CHOICE_MS};
  if (Date.now() > UI.blkT.until){ confirmBlocks(true); }
}

/* ---------- Declaring ---------- */
function declareAttackers(){
  const pn = phaseNow(); if (!pn.mine || !S.cb || S.cb.step !== 'atk') return;
  const sel = Object.entries(UI.atkSel).filter(([, v]) => v);
  const forced = S.bf.filter(c => !canAttack(c) && mustAttack(c) && !UI.atkSel[c.id]);
  if (forced.length){ toast(`${forced.map(cname).join(', ')} must attack if able`); return; }
  const by = {};
  for (const [id, def] of sel){
    const c = S.bf.find(x => x.id === +id); if (!c || canAttack(c)) continue;
    c.atk = def; if (!kwOf(c, 'vigilance')){ if ((c.n || 1) > 1) c.tn = c.n; else c.tap = true; }
    (by[def] = by[def] || []).push(`${(c.n || 1) > 1 ? c.n + '× ' : ''}${cname(c)}`);
    for (let i = 0; i < Math.min(c.n || 1, 30); i++) emit({type:'attack', k:c.k, id:c.id, dp:parseDef(def)?.pid || ''});
  }
  const parts = Object.entries(by).map(([d, l]) => `${defLabel(d)} with ${l.join(', ')}`);
  log(parts.length ? `attacks ${parts.join('; ')}` : 'does not attack');
  UI.atkSel = {};
  setStep('atkd');
}
function confirmBlocks(auto){
  const pn = phaseNow(); const cb = cbOf(pn); if (!cb || cb.step !== 'blk') return;
  const atts = attackersOnMe(pn); const sel = Object.entries(UI.blkSel).filter(([, a]) => a != null && a !== '');
  const count = {}; const ok = [];
  for (const [id, aid] of sel){
    const b = S.bf.find(x => x.id === +id); const a = atts.find(x => x.id === +aid); if (!b || !a) continue;
    if (canBlock(b, a, pn.pid)) continue;
    ok.push([b, a]); count[a.id] = (count[a.id] || 0) + 1;
  }
  const bad = atts.filter(a => count[a.id] === 1 && hasMenace(a, pn.pid) && (a.n || 1) === 1);
  if (bad.length && !auto){ toast(`${info(bad[0].k)?.n} has menace: block it with two or more creatures, or not at all`); return; }
  ok.forEach(([b, a]) => { if (bad.includes(a)) return; b.blk = a.id; });
  const blocked = ok.filter(([, a]) => !bad.includes(a));
  blocked.forEach(([b]) => emit({type:'block', k:b.k, id:b.id}));
  log(blocked.length ? `blocks: ${blocked.map(([b, a]) => `${cname(b)} → ${info(a.k)?.n}`).join(', ')}` : auto ? 'did not block (time ran out)' : 'does not block');
  S.bd = cbKey(pn, cb); UI.blkSel = {}; commit();
}

/* ---------- Combat panel ---------- */
function ensureCbPanel(){ let el = $('#cbpanel'); if (!el){ el = document.createElement('div'); el.id = 'cbpanel'; el.hidden = true; document.body.appendChild(el); } return el; }
function renderCombatPanel(){
  const el = ensureCbPanel(); if (!S || $('#game').hidden){ el.hidden = true; return; }
  const pn = phaseNow(); const cb = pn.mine ? (S.cb && S.cb.t === `${pn.g}.${pn.n}` ? S.cb : null) : cbOf(pn);
  if (pn.ph !== 4 || !cb){ el.hidden = true; return; }
  let h = '';
  if (pn.mine && cb.step === 'atk'){
    const opts = defOpts(); const list = S.bf.filter(c => isCreatureCard(c) && !c.fd);
    const n = Object.values(UI.atkSel).filter(Boolean).length;
    h = `<div class="cbhead"><b>Declare attackers</b><span class="hint">Pick who each creature attacks.</span><span class="spacer"></span>${opts.filter(o => o.key.startsWith('p:')).map(o => `<button class="btn small" type="button" data-act="atkAll" data-d="${esc(o.key)}">Everything → ${esc(o.label)}</button>`).join('')}<button class="btn small" type="button" data-act="atkNone">Clear</button><button class="btn small primary" type="button" data-act="atkGo">${n ? `Attack with ${n}` : 'No attack'}</button></div><div class="cbrows">` +
      list.map(c => { const why = canAttack(c); const st = stats(c) || ['?', '?']; const sel = UI.atkSel[c.id] || '';
        return `<div class="cbrow${why ? ' dis' : ''}"><span class="cbname">${(c.n || 1) > 1 ? c.n + '× ' : ''}${esc(cname(c))} <small>${st[0]}/${st[1]}${kwList(c, MYPID)}${mustAttack(c) ? ' · must attack' : ''}</small></span>` +
          (why ? `<small class="why">${esc(why)}</small>` : `<span class="cbchips"><button type="button" class="chip2${!sel ? ' on' : ''}" data-act="atkSet" data-id="${c.id}" data-d="">—</button>${opts.map(o => `<button type="button" class="chip2${sel === o.key ? ' on' : ''}" data-act="atkSet" data-id="${c.id}" data-d="${esc(o.key)}">${esc(o.label)}</button>`).join('')}</span>`) + '</div>'; }).join('') + '</div>';
  } else if (!pn.mine && cb.step === 'blk' && attackersOnMe(pn).length && (S.bd || '') !== cbKey(pn, cb)){
    const atts = attackersOnMe(pn); const mine = S.bf.filter(c => isCreatureCard(c) && !c.fd);
    const left = UI.blkT ? Math.max(0, Math.ceil((UI.blkT.until - Date.now()) / 1000)) : 60;
    h = `<div class="cbhead"><b>Declare blockers</b><span class="hint">${esc(nameOf(pn.pid))} attacks you with ${atts.map(a => `${(a.n || 1) > 1 ? a.n + '× ' : ''}${esc(info(a.k)?.n)} ${(livePTFor(a, pn.pid) || info(a.k)?.p || '').split(' ')[0]}${kwList(a, pn.pid)}${parseDef(a.atk).t === 'card' ? ' → ' + esc(defLabel(a.atk)) : ''}`).join(', ')}</span><span class="spacer"></span><span class="pcount" id="blkcount">${left}s</span><button class="btn small primary" type="button" data-act="blkGo">Confirm blocks</button></div><div class="cbrows">` +
      mine.map(b => { const sel = UI.blkSel[b.id] ?? ''; const st = stats(b) || ['?', '?'];
        return `<div class="cbrow${b.tap ? ' dis' : ''}"><span class="cbname">${esc(cname(b))} <small>${st[0]}/${st[1]}${kwList(b, MYPID)}</small></span>` + (b.tap ? '<small class="why">tapped</small>' :
          `<span class="cbchips"><button type="button" class="chip2${sel === '' ? ' on' : ''}" data-act="blkSet" data-id="${b.id}" data-a="">No block</button>${atts.map(a => { const why = canBlock(b, a, pn.pid); return `<button type="button" class="chip2${String(sel) === String(a.id) ? ' on' : ''}" data-act="blkSet" data-id="${b.id}" data-a="${a.id}" ${why ? `disabled title="${esc(why)}"` : ''}>Block ${esc(info(a.k)?.n)}${why ? ` <small>(${esc(why)})</small>` : ''}</button>`; }).join('')}</span>`) + '</div>'; }).join('') + '</div>';
  } else {
    const atk = (pn.mine ? S.bf : (OPP.get(pn.pid)?.bf || [])).filter(c => c.atk);
    const step = {begin:'Beginning of combat', atk:'Declaring attackers…', atkd:'Attackers declared', blk:'Waiting for blockers…', blkd:'Blockers declared', fs:'First-strike damage', dmg:'Combat damage', end:'End of combat'}[cb.step] || '';
    if (!atk.length && cb.step === 'begin'){ el.hidden = true; return; }
    h = `<div class="cbhead"><b>${esc(step)}</b><span class="hint">${atk.length ? atk.map(a => `${(a.n || 1) > 1 ? a.n + '× ' : ''}${esc(info(a.k)?.n)} → ${esc(defLabel(a.atk))}`).join(' · ') : ''}</span></div>`;
  }
  el.innerHTML = h; el.hidden = false;
}
function kwList(c, pid){ const k = ['flying','trample','first strike','double strike','deathtouch','lifelink','menace','vigilance','reach','infect','indestructible'].filter(x => kwOf(c, x, pid)); return k.length ? ' · ' + k.join(', ') : ''; }
function renderSplitModal(m){
  const tot = m.plan.to.reduce((s, x) => s + x[1], 0) + (m.trample ? m.plan.rest : 0);
  const rows = m.plan.to.map(([b, n], i) => `<div class="mini-ctr"><span class="lbl">${esc(b.nm)} <small>(lethal ${lethalFor(b, m.a)})</small></span><button type="button" data-act="splitD" data-i="${i}" data-d="-1">−</button><span class="v">${n}</span><button type="button" data-act="splitD" data-i="${i}" data-d="1">+</button></div>`).join('') +
    (m.trample ? `<div class="mini-ctr"><span class="lbl">To ${esc(defLabel(m.a.atk))} (trample)</span><span></span><span class="v">${m.plan.rest}</span><span></span></div>` : '');
  return {title:`${cname(m.a)}: divide ${m.pow} damage`, head:`<button class="btn small primary" type="button" data-act="splitGo" ${tot === m.pow ? '' : 'disabled'}>Done</button>`,
    body:`<p class="hint">Blockers in damage order. ${m.trample ? 'Anything beyond lethal can go to the defender.' : 'All damage must go to the blockers.'}</p><div class="poolrows">${rows}</div>`};
}
// extra combats and "untap all attackers"
async function doCombatText(s, l, ctx){
  let m;
  if ((m = l.match(/^after this (?:main )?phase, there is an additional combat phase(?: followed by an additional main phase)?$/))){ S.xc = (S.xc || 0) + 1; log('gets an additional combat phase'); return true; }
  if ((m = l.match(/^untap all (creatures you control|attacking creatures|creatures that attacked this turn|creatures)$/))){ S.bf.forEach(c => { if (isCreatureCard(c) && (m[1] !== 'attacking creatures' || c.atk)){ c.tap = false; c.tn = 0; } }); log(`untapped ${m[1]}`); return true; }
  return false;
}
function cardPublicExtra(c){ const o = {}; if (c.fd && c.fdc) o.fdc = 1; if (c.sw) o.sw = 1; if (c.emb) o.emb = 1; if (c.att) o.att = {pid:c.att.pid, id:c.att.id}; if (c.atk) o.atk = c.atk; if (c.blk != null) o.blk = c.blk; if (c.lore) o.lore = c.lore; if (c.prot) o.prot = c.prot; return o; }

Object.assign(ACT, {
  atkSet(el){ UI.atkSel[el.dataset.id] = el.dataset.d; renderCombatPanel(); },
  atkAll(el){ S.bf.forEach(c => { if (!canAttack(c)) UI.atkSel[c.id] = el.dataset.d; }); renderCombatPanel(); },
  atkNone(){ UI.atkSel = {}; S.bf.forEach(c => { if (!canAttack(c) && mustAttack(c)) UI.atkSel[c.id] = defOpts()[0]?.key; }); renderCombatPanel(); },
  atkGo(){ declareAttackers(); },
  blkSet(el){ UI.blkSel[el.dataset.id] = el.dataset.a === '' ? '' : +el.dataset.a; renderCombatPanel(); },
  blkGo(){ confirmBlocks(false); },
  splitD(el){ const m = UI.modal; const i = +el.dataset.i; const d = +el.dataset.d; const row = m.plan.to[i];
    if (d > 0){ if (m.trample && m.plan.rest > 0) m.plan.rest--; else { const j = m.plan.to.findIndex((x, k) => k !== i && x[1] > 0); if (j < 0) return; m.plan.to[j][1]--; } row[1]++; }
    else { if (row[1] <= 0) return; row[1]--; if (m.trample) m.plan.rest++; else { const j = m.plan.to.findIndex((x, k) => k !== i); if (j < 0){ row[1]++; return; } m.plan.to[j][1]++; } }
    renderModal(); },
  splitGo(){ const m = UI.modal; m.onClose = null; closeModal(); m.resolve(m.plan); },
});
