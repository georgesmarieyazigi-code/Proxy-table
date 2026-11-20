
/* =============================================================
   Rules engine — round 4
   Planeswalker loyalty abilities, sagas, battles, counter and token
   doublers, proliferate, the command-zone setting, maximum hand size
   and undo.
   ============================================================= */
UI.cmdz = store.get('pt.cmdz') !== false;     // "Always send my commander to the command zone"
UI.undo = [];

/* ---------- Counter and token doublers ---------- */
function sentencesOf(k, fl){ const a = info(k); if (!a) return []; const f = fl && a.back ? a.back : a; return tname(f.o, f.n).toLowerCase().split(/\.\s*|\n/); }
// how many counters actually land on c (controlled by ownerPid) when `putter` puts n of `kind` on it
function modCounters(c, kind, n, putter=MYPID, ownerPid=MYPID){
  if (n <= 0) return 0;
  let plus = 0, mult = 1, half = false;
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue;
    for (const sen of sentencesOf(s.k, s.fl)){
      if (!/counters?/.test(sen) || !/would (be put|put)/.test(sen)) continue;
      if (/^if you would put one or more counters/.test(sen)){ if (b.pid === putter) mult *= 2; continue; }
      if (/^if an opponent would put one or more counters/.test(sen)){ if (b.pid !== putter) half = true; continue; }
      const plusOnly = /\+1\/\+1 counters? would/.test(sen) || /one or more \+1\/\+1 counters/.test(sen);
      if (plusOnly && kind !== 'cp') continue;
      if (/you control/.test(sen) && b.pid !== ownerPid) continue;
      if (/on a creature/.test(sen) && !isCreatureCard(c)) continue;
      if (/plus one/.test(sen)) plus++; else if (/three times/.test(sen)) mult *= 3; else if (/twice/.test(sen)) mult *= 2;
    }
  }
  let out = (n + plus) * mult; if (half) out = Math.floor(out / 2);
  if (out !== n) log(`${n} counter${n > 1 ? 's' : ''} became ${out} on ${cname(c)} (replacement effects)`);
  if (kind === 'lore'){ const before = c.lore || 0; c.lore = before + out; sagaReached(c, before, c.lore); return out; }
  c[kind] = (c[kind] || 0) + out; cancelCounters(c);
  return out;
}
// Vorinclex-style effects also change counters put on players (poison)
function playerCounterMod(n, putter){
  let mult = 1, half = false;
  for (const b of boardsAll()) for (const s of b.bf){ if (!s.k || s.fd) continue;
    for (const sen of sentencesOf(s.k, s.fl)){
      if (/^if you would put one or more counters on a permanent or player/.test(sen) && b.pid === putter) mult *= 2;
      if (/^if an opponent would put one or more counters on a permanent or player/.test(sen) && b.pid !== putter) half = true;
    } }
  let out = n * mult; if (half) out = Math.floor(out / 2); return out;
}
function tokenMult(k){
  let mult = 1; const creature = /Creature/.test(info(k)?.t || '');
  for (const b of boardsAll()) for (const s of b.bf){
    if (!s.k || s.fd) continue;
    for (const sen of sentencesOf(s.k, s.fl)){
      if (!/tokens? would be created|would create one or more/.test(sen)) continue;
      if (/under your control|you would create/.test(sen) && b.pid !== MYPID) continue;
      if (/creature tokens?/.test(sen) && !creature) continue;
      if (/three times/.test(sen)) mult *= 3; else if (/twice/.test(sen)) mult *= 2;
    }
  }
  return mult;
}

/* ---------- Planeswalkers ---------- */
function loyaltyAbs(c){
  const f = faceOf(c); if (!f || !isPW(c)) return [];
  return tname(f.o, f.n).split('\n').map(l => l.trim().match(/^([+−\-]?(?:\d+|X)):\s*(.+)$/)).filter(Boolean)
    .map(m => ({raw:m[1], cost: m[1] === 'X' ? 0 : m[1].replace('−', '-'), eff:m[2]}));
}
function loyaltyReady(c, ab){
  const pn = phaseNow();
  if (!pn.mine) return 'Only on your turn';
  if (!sorceryTime()) return 'Only in your main phase with an empty stack';
  if (c.lu === turnStr()) return 'Already used a loyalty ability this turn';
  const v = /X/.test(ab.cost) ? 0 : +ab.cost;
  if (v < 0 && (c.co || 0) < -v) return `Needs ${-v} loyalty`;
  return '';
}
async function activateLoyalty(c, i){
  const ab = loyaltyAbs(c)[i]; if (!ab) return;
  const why = loyaltyReady(c, ab); if (why){ toast(why); return; }
  closeModal();
  let v = +String(ab.cost).replace('X', '');
  if (/X/.test(ab.cost)){ const x = await askNumber(`${cname(c)}: choose X`, `Loyalty ${c.co || 0}`, 1); if (x == null) return; v = String(ab.cost).startsWith('-') ? -x : x; if (-v > (c.co || 0)){ toast('Not enough loyalty'); return; } }
  let tgts = null;
  if (targetSpecs(ab.eff).length){ tgts = await chooseTargets(ab.eff, {pid:MYPID, col:info(c.k)?.c, types:typeOf(c), id:c.id}, cname(c)); if (tgts == null) return; }
  c.co = Math.max(0, (c.co || 0) + v); c.lu = turnStr(); clearUndo();
  const it = {sid:rid(6), o:nextO(), kind:'ability', k:c.k, nm:cname(c), txt:ab.eff, srcId:c.id, tgts, tgtNm:tgtLabel(tgts)};
  S.stk.push(it); S.pass = 's:' + it.sid;
  log(`activated ${cname(c)} ${ab.raw}: ${short(ab.eff, 80)}${it.tgtNm ? ' targeting ' + it.tgtNm : ''} (loyalty ${c.co})`); commit();
}
function renderPwModal(m){
  const c = find(m.id)[2]; if (!c) return null;
  return {title:`${cname(c)} — loyalty ${c.co || 0}`, body:`<div class="pwgrid"><div class="pwcard">${cardHTML(c.k, {fl:c.fl})}</div><div class="choices">${loyaltyAbs(c).map((ab, i) => { const why = loyaltyReady(c, ab);
    return `<button class="btn${why ? '' : ' primary'}" type="button" data-act="pwGo" data-id="${c.id}" data-i="${i}" ${why ? 'disabled' : ''}><span><b class="lc">${esc(ab.raw)}</b> ${manaHTML(ab.eff)}</span>${why ? `<small>${esc(why)}</small>` : ''}</button>`; }).join('')}</div></div>`};
}

/* ---------- Sagas ---------- */
const ROMAN = {I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7};
function sagaChapters(c){
  const f = faceOf(c); if (!f || !/\bSaga\b/.test(f.t)) return null;
  const out = [];
  tname(f.o, f.n).split('\n').forEach(l => { const m = l.trim().match(/^((?:I|II|III|IV|V|VI|VII)(?:, (?:I|II|III|IV|V|VI|VII))*) — (.+)$/); if (m) m[1].split(', ').forEach(r => out.push({n:ROMAN[r], eff:m[2]})); });
  return out.length ? out : null;
}
function sagaReached(c, from, to){
  const ch = sagaChapters(c); if (!ch) return; const max = Math.max(...ch.map(x => x.n));
  for (let n = from + 1; n <= Math.min(to, max); n++){
    ch.filter(x => x.n === n).forEach(x => {
      const it = {sid:rid(6), o:nextO(), kind:'trigger', k:c.k, nm:`${cname(c)} (chapter ${Object.keys(ROMAN)[n - 1]})`, txt:x.eff, srcId:c.id, op:'saga', final:n >= max};
      S.stk.push(it); S.pass = 's:' + it.sid; log(`chapter ${Object.keys(ROMAN)[n - 1]}: ${short(x.eff, 80)}`);
    });
  }
}
function sagaDone(it){
  const [z,,c] = find(it.srcId); if (z !== 'bf') return;
  const ch = sagaChapters(c); if (!ch) return; const max = Math.max(...ch.map(x => x.n));
  if ((c.lore || 0) >= max && !S.stk.some(x => x.op === 'saga' && x.srcId === c.id)){ log(`${cname(c)} finished its last chapter`); sacrificeOne(c); }
}

/* ---------- Battles ---------- */
async function battleEnter(c){
  const f = faceOf(c); const d = parseInt(String(f.p || '').replace(/^D/, ''), 10) || 0;
  c.bt = 1; c.co = 0; modCounters(c, 'co', d);
  const opp = opponents();
  if (opp.length){
    c.prot = opp[0].pid;
    if (opp.length > 1){ const v = await askChoice({title:`${cname(c)}: which opponent protects it?`, options:opp.map(p => ({label:p.nm, value:p.pid}))}); if (v) c.prot = v; }
    log(`${cname(c)} enters with ${c.co} defense, protected by ${nameOf(c.prot)}`); commit();
  }
}
async function battleDefeated(c){
  const a = info(c.k); log(`${cname(c)} was defeated`);
  moveCard(c.id, 'ex', {quiet:true, manual:true});
  if (a && a.back && /cast it transformed without paying its mana cost/i.test(a.o)){
    if (await askYes(`Cast ${a.back.n} (the back of ${a.n}) without paying its mana cost?`, 'Cast it', 'No')){
      const [z] = find(c.id); if (z !== 'ex') return;
      S.ex.splice(S.ex.indexOf(c), 1); c.fl = true;
      const it = {sid:rid(6), o:nextO(), kind:'spell', card:c, k:c.k, nm:a.back.n, txt:a.back.o, mv:a.mv || 0, ty:a.back.t, flip:true, from:'ex'};
      S.stk.push(it); S.pass = 's:' + it.sid; log(`cast ${a.back.n} transformed`); commit();
    }
  }
}
function attackTargetProtector(d){ if (!d || d.t !== 'card') return d ? d.pid : null; const c = boardOf(d.pid).find(x => x.id === d.id); return c && c.prot ? c.prot : d.pid; }

/* ---------- Proliferate ---------- */
async function proliferate(name){
  const items = [];
  const kinds = c => ['cp','cm','co','lore'].filter(k => (c[k] || 0) > 0);
  for (const b of boardsAll()) for (const c of b.bf){
    if (!c.k || c.fd) continue; const ks = kinds(c); if (!ks.length) continue;
    const mine = b.pid === MYPID; const good = mine ? ks.some(k => k === 'cp' || (k === 'co' && (isPW(c) || !isBattle(c)))) : ks.includes('cm') || (ks.includes('co') && isBattle(c));
    items.push({pid:b.pid, id:c.id, k:c.k, ks, on:good, label:`${mine ? '' : nameOf(b.pid) + "'s "}${info(c.k)?.n} (${ks.map(k => ({cp:'+1/+1', cm:'−1/−1', co:isPW(c) ? 'loyalty' : isBattle(c) ? 'defense' : 'counter', lore:'lore'}[k] + ' ' + c[k])).join(', ')})`});
  }
  for (const p of players()){ const psn = p.me ? S.psn : p.s?.psn; if (psn > 0) items.push({pid:p.pid, player:true, ks:['psn'], on:!p.me, label:`${p.me ? 'You' : p.nm}: ${psn} poison`}); }
  if (!items.length){ log('proliferate: nothing has counters'); return; }
  let sel = items.map(x => x.on);
  const r = replayAns();
  if (r !== undefined) sel = Array.isArray(r) ? r : sel;
  else { sel = await recAns(new Promise(res => openModal({type:'prolif', key:rid(4), title:`${name}: proliferate`, items, sel, resolve:res, onClose:() => res(null)}))); if (!sel) return; }
  const done = [];
  items.forEach((x, i) => {
    if (!sel[i]) return;
    if (x.player){ if (x.pid === MYPID) S.psn += playerCounterMod(1, MYPID); else sendRq(x.pid, 'psn', 1, name); done.push(x.label.split(':')[0]); return; }
    if (x.pid === MYPID){ const c = S.bf.find(b => b.id === x.id); if (c) x.ks.forEach(k => modCounters(c, k, 1)); }
    else x.ks.forEach(k => sendRq(x.pid, 'ctr', 1, name, {tid:x.id, d:k}));
    done.push(x.label.replace(/ \(.*$/, ''));
  });
  log(`proliferated: ${done.join(', ') || 'nothing'}`); commit();
}
function renderProlifModal(m){
  return {title:m.title, head:`<button class="btn small primary" type="button" data-act="prolifGo">Proliferate</button>`,
    body:`<p class="hint">Each ticked permanent or player gets one more of each kind of counter it already has. Pre-ticked: the ones that help you.</p><div class="prolist">${m.items.map((x, i) =>
      `<label class="prorow" style="--seatc:${seatColor(x.pid)}"><input type="checkbox" data-pro="${i}" ${m.sel[i] ? 'checked' : ''}> ${esc(x.label)}</label>`).join('')}</div>`};
}

/* ---------- Command zone setting ---------- */
function cmdRedirect(c, from, to){
  if (UI.cmdz){ moveCard(c.id, 'cz', {manual:true, quiet:true}); log(`${cname(c)} went to the command zone instead of ${ZNAME[to]}`); return true; }
  setTimeout(async () => { const [z] = find(c.id); if (z !== to) return; if (await askYes(`${cname(c)} is going to your ${ZNAME[to]}. Move it to the command zone instead?`, 'Command zone', `Leave it in ${ZNAME[to]}`)){ const [z2] = find(c.id); if (z2 === to) moveCard(c.id, 'cz', {manual:true}); } }, 0);
  return false;
}

/* ---------- Maximum hand size ---------- */
const noMaxHand = () => !!S.noMax || S.bf.some(b => !b.fd && /you have no maximum hand size/i.test(textOf(b)));
async function cleanupHand(){
  const over = S.hand.length - 7;
  if (over <= 0 || noMaxHand()) return;
  let ids = null;
  while (!ids){ ids = await pickCards({title:`Cleanup: discard ${over} card${over > 1 ? 's' : ''} (maximum hand size 7)`, cards:S.hand.slice(), min:over, max:over, noClose:true}); }
  ids.forEach(id => moveCard(id, 'gy', {manual:true})); log(`discarded down to 7`);
}

/* ---------- Undo ---------- */
const UNDO_FIELDS = ['lib','hand','bf','gy','ex','cz','life','psn','cdt','tax','pool','landT','recent','rh'];
const HARMLESS = new Set(['tap','ctr','life','psn','cdt','stack','tok1','mkTok','presetTok','mv','poolD','poolClear','putBf','flip','fd','copy','playLand','manaGo','manaAb','loreD']);
const REVEALS = new Set(['draw','drawN','lookTop','search','shuffle','shuffleClose','revealTop','mull','cast','castFree','actAb','gyCast','millN','topFd','mvz','pwGo','passPrio','respond','next','startTurn','passTurn']);
function snap(label){ if (!S) return; UI.undo.push({label, nid:S.nid, data:JSON.stringify(UNDO_FIELDS.map(f => S[f]))}); if (UI.undo.length > 10) UI.undo.shift(); }
function clearUndo(){ UI.undo = []; }
function undoHook(act){ if (!S || $('#game').hidden) return; if (HARMLESS.has(act)) snap(act); else if (REVEALS.has(act)) clearUndo(); }
const UNDO_NAMES = {tap:'tap', ctr:'counter', life:'life change', psn:'poison', cdt:'commander damage', stack:'token change', tok1:'token', mkTok:'token', presetTok:'token', mv:'move', poolD:'mana change', poolClear:'mana change', putBf:'put onto battlefield', flip:'transform', fd:'face down', copy:'token copy', playLand:'land', manaGo:'mana', manaAb:'mana', loreD:'lore counter', quick:'tap for mana'};
function undo(){
  const u = UI.undo.pop(); if (!u || !S) return;
  const vals = JSON.parse(u.data); UNDO_FIELDS.forEach((f, i) => { S[f] = vals[i]; }); S.nid = Math.max(S.nid, u.nid);
  log(`undid: ${UNDO_NAMES[u.label] || u.label}`); commit();
}

/* ---------- Menus, badges ---------- */
function round4MenuItems(c){
  let h = '';
  if (isPW(c) && !c.fd) h += mb('pwOpen', `Loyalty abilities (loyalty ${c.co || 0})…`, `data-id="${c.id}"`);
  if (sagaChapters(c)) h += `<div class="grid2">${mb('loreD', 'Lore +1 (by hand)', `data-id="${c.id}" data-d="1"`)}${mb('loreD', 'Lore −1 (by hand)', `data-id="${c.id}" data-d="-1"`)}</div>`;
  return h ? h + '<div class="sep"></div>' : '';
}
function gameMenuExtra(){ return `<div class="sep"></div>` + mb('toggleCmdz', `Always send my commander to the command zone: <b>${UI.cmdz ? 'on' : 'off'}</b>`) + (typeof strictMenu === 'function' ? strictMenu() : ''); }
function undoButtonHTML(){ return `<button class="btn small" type="button" data-act="undo" ${UI.undo.length ? '' : 'disabled'} title="${UI.undo.length ? 'Undo: ' + esc(UNDO_NAMES[UI.undo[UI.undo.length - 1].label] || '') : 'Nothing to undo'}">Undo${UI.undo.length ? ' (' + UI.undo.length + ')' : ''}</button>`; }

Object.assign(ACT, {
  pwOpen(el){ closeMenu(); openModal({type:'pw', id:+el.dataset.id, key:rid(4)}); },
  pwGo(el){ const [,,c] = find(+el.dataset.id); if (c) activateLoyalty(c, +el.dataset.i); },
  loreD(el){ const [,,c] = find(+el.dataset.id); if (!c) return; c.lore = Math.max(0, (c.lore || 0) + (+el.dataset.d)); log(`set ${cname(c)} to lore ${c.lore} by hand`); commit(); },
  prolifGo(){ const m = UI.modal; if (!m || m.type !== 'prolif') return; document.querySelectorAll('#modal input[data-pro]').forEach(i => { m.sel[+i.dataset.pro] = i.checked; }); m.onClose = null; closeModal(); m.resolve(m.sel); },
  toggleCmdz(){ UI.cmdz = !UI.cmdz; store.set('pt.cmdz', UI.cmdz); closeMenu(); toast(UI.cmdz ? 'Your commander goes to the command zone automatically' : "You'll be asked each time your commander would change zones"); },
  undo(){ undo(); },
});
