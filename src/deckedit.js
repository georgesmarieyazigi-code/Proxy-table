/* ===================== Deck editor and deck test (lobby → Deck page) =====================
   Add any card (Scryfall search), remove cards, change counts, set the commander, then test the deck:
   sample opening hands with London mulligans, draw on, mana curve, colour sources and an opening-hand simulation. */
const DE = { sugg:[], tq:0, test:null, sim:null, filter:'' };
const deTypeOf = k => { const t = info(k)?.t || ''; for (const x of ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land']) if (new RegExp('\\b' + x + '\\b').test(t.split('//')[0])) return x === 'Land' && /Creature/.test(t) ? 'Creature' : x; return 'Other'; };
const deIsLand = k => /\bLand\b/.test((info(k)?.t || '').split('//')[0]) && !/\bCreature\b/.test(info(k)?.t || '');
function deChanged(){ LOBBY.deckEdited = true; renderDeckSum(); renderDeckEdit(); }
function deAdd(k, q = 1){ const d = LOBBY.deck; if (!d) return; const e = d.main.find(x => x.k === k); if (e) e.q += q; else d.main.push({k, q}); d.main = d.main.filter(x => x.q > 0); deChanged(); }
async function deAddByName(name, q = 1){
  name = String(name || '').trim(); if (!name) return;
  const local = [...DICT.values()].find(a => !a.tok && (a.n || '').toLowerCase() === name.toLowerCase());
  if (local){ deAdd(local.k, q); deStatus(`Added ${q} ${local.n}`, 'ok'); return; }
  deStatus(`Looking up “${name}” on Scryfall…`);
  try {
    let c = await sf('/cards/named?exact=' + encodeURIComponent(name));
    if (!c || c.object !== 'card') c = await sf('/cards/named?fuzzy=' + encodeURIComponent(name));
    if (!c || c.object !== 'card'){ deStatus(`No card called “${name}” on Scryfall.`, 'err'); return; }
    const a = infoFrom(c); DICT.set(a.k, a); try { await ensureTokens((a.toks || []).map(t => t.id)); } catch {}
    deAdd(a.k, q); deStatus(`Added ${q} ${a.n}`, 'ok');
  } catch (e){ deStatus(`Couldn't reach Scryfall: ${e.message}`, 'err'); }
}
function deStatus(msg, cls = ''){ const el = $('#deStatus'); if (el){ el.textContent = msg; el.className = 'status ' + cls; } }
async function deSuggest(q){
  const my = ++DE.tq; q = String(q || '').trim(); if (q.length < 2){ DE.sugg = []; deRenderSugg(); return; }
  // cards we already know first, then Scryfall's autocomplete
  const local = [...new Set([...DICT.values()].filter(a => !a.tok && (a.n || '').toLowerCase().includes(q.toLowerCase())).map(a => a.n))].slice(0, 8);
  DE.sugg = local; deRenderSugg();
  await sleep(220); if (my !== DE.tq) return;
  try { const r = await sf('/cards/autocomplete?q=' + encodeURIComponent(q)); if (my !== DE.tq) return; DE.sugg = [...new Set([...local, ...((r && r.data) || [])])].slice(0, 12); deRenderSugg(); } catch {}
}
function deRenderSugg(){ const dl = $('#deSugg'); if (dl) dl.innerHTML = DE.sugg.map(n => `<option value="${esc(n)}"></option>`).join(''); }

/* ---- stats ---- */
function deStats(d){
  const curve = Array(8).fill(0); let lands = 0, nonland = 0, mvSum = 0; const pips = {W:0, U:0, B:0, R:0, G:0}; const src = {W:0, U:0, B:0, R:0, G:0, C:0};
  const all = d.main.map(e => [e.k, e.q]).concat(d.cmd.map(k => [k, 1]));
  for (const [k, q] of all){ const a = info(k); if (!a) continue;
    if (deIsLand(k)){ lands += q;
      const t = (a.o || '') + ' ' + (a.t || ''); const cols = new Set();
      ({Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'}); for (const [bt, c] of Object.entries({Plains:'W', Island:'U', Swamp:'B', Mountain:'R', Forest:'G'})) if (new RegExp('\\b' + bt + '\\b').test(a.t || '')) cols.add(c);
      (t.match(/\{([WUBRGC])\}/g) || []).forEach(s => cols.add(s[1]));
      if (/any color|any type|commander's color identity/i.test(t)) 'WUBRG'.split('').forEach(c => cols.add(c));
      cols.forEach(c => src[c] += q); continue; }
    if (d.cmd.includes(k)) continue;
    nonland += q; const mv = a.mv || 0; mvSum += mv * q; curve[Math.min(7, mv)] += q;
    ((a.m || '').match(/\{([WUBRG])(?:\/[WUBRGP])?\}/g) || []).forEach(s => pips[s[1]] += q);
  }
  return {curve, lands, nonland, avg:nonland ? mvSum / nonland : 0, pips, src};
}
function deLibrary(d){ const lib = []; d.main.forEach(e => { for (let i = 0; i < e.q; i++) lib.push(e.k); }); return lib; }
function deShuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function deSimulate(d, n = 4000){
  const lib = deLibrary(d); if (lib.length < 8) return null;
  const isL = lib.map(deIsLand); const idx = lib.map((_, i) => i); let keep = 0, screw = 0, flood = 0, sum = 0; const byTurn4 = [0];
  for (let t = 0; t < n; t++){ deShuffle(idx); let l = 0; for (let i = 0; i < 7; i++) if (isL[idx[i]]) l++; sum += l; if (l >= 2 && l <= 4) keep++; else if (l < 2) screw++; else flood++;
    let l4 = l; for (let i = 7; i < 10; i++) if (isL[idx[i]]) l4++; if (l4 >= 4) byTurn4[0]++; }
  return {keep:keep / n, screw:screw / n, flood:flood / n, avg:sum / n, t4:byTurn4[0] / n};
}
function deNewHand(mull){
  const d = LOBBY.deck; if (!d) return; const lib = deShuffle(deLibrary(d));
  const prev = DE.test; const m = mull ? (prev ? prev.mull + 1 : 1) : 0;
  DE.test = {lib, hand:lib.splice(0, 7), mull:m, drawn:0};
  renderDeckEdit();
}
function deDraw(){ if (!DE.test || !DE.test.lib.length) return; DE.test.hand.push(DE.test.lib.shift()); DE.test.drawn++; renderDeckEdit(); }

/* ---- rendering ---- */
function renderDeckEdit(){
  const el = $('#deckEdit'); if (!el) return;
  const d = LOBBY.deck; if (!d || !(d.main.length || d.cmd.length)){ el.hidden = true; return; }
  el.hidden = false;
  const st = deStats(d); const maxC = Math.max(1, ...st.curve);
  const groups = {}; d.main.forEach(e => { const g = deTypeOf(e.k); (groups[g] = groups[g] || []).push(e); });
  const order = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Other'];
  const f = DE.filter.toLowerCase();
  const row = e => { const a = info(e.k) || {n:'?'}; if (f && !a.n.toLowerCase().includes(f)) return '';
    return `<div class="de-row" data-k="${esc(e.k)}"><span class="de-q"><button type="button" class="btn small ghost" data-de="minus" data-k="${esc(e.k)}" aria-label="One fewer">−</button><b>${e.q}</b><button type="button" class="btn small ghost" data-de="plus" data-k="${esc(e.k)}" aria-label="One more">+</button></span><span class="de-n" data-de="peek" data-k="${esc(e.k)}">${esc(a.n)}</span><span class="de-m">${manaHTML(a.m || '')}</span>${a.cc && FMT[LOBBY.fmt].cz ? `<button type="button" class="btn small ghost" data-de="cmd" data-k="${esc(e.k)}" title="Make this your commander">★</button>` : ''}<button type="button" class="btn small ghost" data-de="del" data-k="${esc(e.k)}" title="Remove all copies">✕</button></div>`; };
  const t = DE.test; const sim = DE.sim;
  const handHTML = t ? `<div class="de-hand">${t.hand.map(k => { const a = info(k) || {}; return a.img ? `<img src="${esc(a.img)}" alt="${esc(a.n || '')}" title="${esc(a.n || '')}" loading="lazy">` : `<span class="de-txt">${esc(a.n || '?')}</span>`; }).join('')}</div>
      <div class="row" style="justify-content:space-between"><span class="hint">${t.mull ? `Mulligan ${t.mull}: keep 7, put ${t.mull} on the bottom · ` : ''}${t.hand.filter(deIsLand).length} land${t.hand.filter(deIsLand).length === 1 ? '' : 's'} in ${t.hand.length} cards${t.drawn ? ` · drew ${t.drawn}` : ''} · ${t.lib.length} left in library</span>
      <span class="row"><button class="btn small" type="button" data-de="draw" ${t.lib.length ? '' : 'disabled'}>Draw a card</button><button class="btn small" type="button" data-de="mull">Mulligan</button><button class="btn small" type="button" data-de="hand">New hand</button></span></div>` :
    `<div class="row"><button class="btn small primary" type="button" data-de="hand">Draw an opening hand</button><span class="hint">Shuffle and draw 7, mulligan, then draw on to see your first turns.</span></div>`;
  el.innerHTML = `
    <div class="de-sec"><h3>Edit the deck</h3>${DE.peek && info(DE.peek) ? `<div class="de-peek"><img src="${esc(info(DE.peek).img || '')}" alt="${esc(info(DE.peek).n)}"><div><b>${esc(info(DE.peek).n)}</b> ${manaHTML(info(DE.peek).m || '')}<div class="hint">${esc(info(DE.peek).t || '')}</div><div class="de-otxt">${esc(info(DE.peek).o || '').replace(/\n/g, '<br>')}</div><button class="btn small ghost" type="button" data-de="peek" data-k="${esc(DE.peek)}">Close</button></div></div>` : ''}
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="deAddIn" list="deSugg" placeholder="Add a card: type its name" autocomplete="off" spellcheck="false" aria-label="Card to add"><datalist id="deSugg">${DE.sugg.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist><input type="number" id="deAddQ" min="1" max="99" value="1" aria-label="How many" style="width:64px"><button class="btn primary" type="button" data-de="add">Add</button></div>
      <div class="status" id="deStatus" role="status"></div>
      <div class="row" style="justify-content:space-between"><input type="text" id="deFilter" placeholder="Find in deck" value="${esc(DE.filter)}" style="max-width:240px" aria-label="Find in deck"><span class="hint">${LOBBY.deckEdited ? '<b>Edited</b> — press Save above to keep the changes' : 'Click a name to see the card · ★ makes it your commander'}</span></div>
      ${d.cmd.length ? `<div class="de-grp"><div class="label">Commander</div>${d.cmd.map(k => `<div class="de-row"><span class="de-q"><b>1</b></span><span class="de-n" data-de="peek" data-k="${esc(k)}">${esc(info(k)?.n || '?')}</span><span class="de-m">${manaHTML(info(k)?.m || '')}</span><button type="button" class="btn small ghost" data-de="uncmd" data-k="${esc(k)}" title="Move into the deck">↓</button></div>`).join('')}</div>` : ''}
      <div class="de-cols">${order.filter(g => groups[g]).map(g => { const list = groups[g].slice().sort((x, y) => (info(x.k)?.mv || 0) - (info(y.k)?.mv || 0) || (info(x.k)?.n || '').localeCompare(info(y.k)?.n || '')); const n = list.reduce((s, e) => s + e.q, 0); const rows = list.map(row).join(''); return rows ? `<div class="de-grp"><div class="label">${g === 'Other' ? 'Other' : g + (g === 'Sorcery' ? '' : '')} (${n})</div>${rows}</div>` : ''; }).join('')}</div>
    </div>
    <div class="de-sec"><h3>Test the deck</h3>
      <div class="de-stats">
        <div><div class="label">Mana curve (nonland, avg ${st.avg.toFixed(2)})</div><div class="de-curve">${st.curve.map((n, i) => `<div class="bar" title="${n} card${n === 1 ? '' : 's'} at ${i}${i === 7 ? '+' : ''}"><span style="height:${Math.round(80 * n / maxC)}px"></span><i>${n}</i><b>${i}${i === 7 ? '+' : ''}</b></div>`).join('')}</div></div>
        <div><div class="label">Colours: pips in costs / land sources</div><div class="de-cols2">${'WUBRG'.split('').filter(c => st.pips[c] || d.cmd.some(k => (info(k)?.ci || '').includes(c))).map(c => `<div>${manaHTML('{' + c + '}')} <b>${st.pips[c]}</b> pips · <b>${st.src[c]}</b> sources${st.pips[c] && st.src[c] < Math.min(15, 6 + st.pips[c] / 3) ? ' <span class="warn" title="Few sources for how many pips you play">low</span>' : ''}</div>`).join('') || '<span class="hint">Colourless</span>'}</div>
          <div class="hint" style="margin-top:6px"><b>${st.lands}</b> lands · <b>${st.nonland}</b> other cards</div></div>
        <div><div class="label">Opening hands (simulated)</div>${sim ? `<div class="hint">2–4 lands in 7: <b>${Math.round(sim.keep * 100)}%</b> · too few: ${Math.round(sim.screw * 100)}% · too many: ${Math.round(sim.flood * 100)}%<br>Average ${sim.avg.toFixed(1)} lands in 7 · 4+ lands by turn 4 (on the play): <b>${Math.round(sim.t4 * 100)}%</b></div>` : ''}<button class="btn small" type="button" data-de="sim">${sim ? 'Run again' : 'Simulate 4,000 hands'}</button></div>
      </div>
      ${handHTML}
      <div class="row"><button class="btn small" type="button" data-act="checkDeck">Check every card's rules text</button><button class="btn small" type="button" data-de="goldfish">Goldfish it (play solo)</button></div>
    </div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-de]'); if (!b || !b.closest('#deckEdit')) return;
  const d = LOBBY.deck; if (!d) return; const k = b.dataset.k; const a = b.dataset.de;
  if (a === 'plus') deAdd(k, 1);
  else if (a === 'minus') deAdd(k, -1);
  else if (a === 'del'){ d.main = d.main.filter(x => x.k !== k); deChanged(); }
  else if (a === 'cmd'){ toCmd(d, k); deChanged(); }
  else if (a === 'uncmd'){ fromCmd(d, k); deChanged(); }
  else if (a === 'add'){ const n = $('#deAddIn').value; const q = clamp(parseInt($('#deAddQ').value, 10) || 1, 1, 99); await deAddByName(n, q); const i = $('#deAddIn'); if (i){ i.value = ''; i.focus(); } }
  else if (a === 'hand') deNewHand(false);
  else if (a === 'mull') deNewHand(true);
  else if (a === 'draw') deDraw();
  else if (a === 'sim'){ DE.sim = deSimulate(d); renderDeckEdit(); }
  else if (a === 'peek'){ DE.peek = DE.peek === k ? null : k; renderDeckEdit(); }
  else if (a === 'goldfish'){ lobbyPage('play'); $('#soloBtn')?.click(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'deAddIn') deSuggest(e.target.value);
  if (e.target.id === 'deFilter'){ DE.filter = e.target.value; const pos = e.target.selectionStart; renderDeckEdit(); const f = $('#deFilter'); if (f){ f.focus(); f.setSelectionRange(pos, pos); } }
});
document.addEventListener('keydown', e => { if (e.target.id === 'deAddIn' && e.key === 'Enter'){ e.preventDefault(); document.querySelector('#deckEdit [data-de="add"]')?.click(); } });
{
  const rds = renderDeckSum; renderDeckSum = function(){ const r = rds.apply(this, arguments); if (!document.querySelector('#deckEdit :focus')) renderDeckEdit(); return r; };
  // a newly loaded deck starts clean
  const ds = deckStatus; deckStatus = function(msg, cls){ if (/^(Deck ready|Loaded “)/.test(String(msg))){ LOBBY.deckEdited = false; DE.test = null; DE.sim = null; DE.filter = ''; } return ds.apply(this, arguments); };
  const sd = saveDeck; saveDeck = function(){ const r = sd.apply(this, arguments); LOBBY.deckEdited = false; renderDeckEdit(); return r; };
}
