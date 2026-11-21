/* ===== topdecks: "Top commanders" — pick one of the most-played commanders and load a real deck for it =====
   Data: topdecks.json on the game's site, rebuilt on GitHub by tools/topdecks.mjs from
   MTGTop8 (cEDH and Duel Commander top 8s, last 6 months) and EDHREC (most-played commanders, average decks). */
const TD_URL = 'https://georgesmarieyazigi-code.github.io/Proxy-table/topdecks.json';
const TD = {data:null, busy:false, err:'', tab:'cedh', q:'', open:null};
const TD_TABS = [['cedh', 'cEDH top 8s', 'Competitive Commander tournaments (MTGTop8, last 6 months)'], ['duel', 'Duel Commander top 8s', 'Duel Commander tournaments (MTGTop8, last 6 months)'], ['edhrec', 'Most played (EDHREC)', 'The most-built commanders of the past year, with EDHREC’s average deck']];
const TD_CSS = `
.td-ov{position:fixed;inset:0;z-index:150;background:rgba(4,8,6,.78);backdrop-filter:blur(5px);display:grid;place-items:center;animation:u28fade .2s both}
.td-box{width:min(1180px,96vw);height:min(860px,92vh);display:grid;grid-template-rows:auto auto 1fr;gap:12px;background:var(--panel);border:1px solid rgba(212,168,79,.45);border-radius:18px;padding:18px 20px;box-shadow:0 30px 80px rgba(0,0,0,.7);animation:d29zoom .3s cubic-bezier(.2,.9,.3,1.2) both}
.td-head{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.td-head h2{margin:0;font:700 26px/1.1 var(--f-display)}
.td-head .hint{margin:2px 0 0}
.td-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.td-bar input{flex:1;min-width:220px;font-size:15px;padding:10px 12px;border-radius:10px}
.td-tabs{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(8,14,12,.7);border:1px solid var(--line)}
.td-tabs button{border:0;background:none;color:var(--dim);font:600 14px/1 var(--f-body);padding:9px 16px;border-radius:999px;cursor:pointer;transition:all .2s}
.td-tabs button[aria-selected="true"]{background:var(--brass);color:var(--brass-ink);box-shadow:0 0 16px rgba(212,168,79,.4)}
.td-list{overflow:auto;display:grid;grid-auto-rows:max-content;min-height:0;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;align-content:start;padding:2px 4px 10px 2px}
.td-c{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#0c1712 center 30%/cover no-repeat;min-height:118px;cursor:pointer;transition:transform .18s cubic-bezier(.2,.9,.3,1.3),border-color .18s;animation:d29deal .35s both}
.td-c:hover{transform:translateY(-3px);border-color:rgba(212,168,79,.7)}
.td-c .sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,14,12,.95) 0,rgba(8,14,12,.75) 55%,rgba(8,14,12,.35))}
.td-c .in{position:relative;padding:12px 14px;display:grid;gap:4px}
.td-c .rk{font:800 12px/1 var(--f-body);color:var(--brass);letter-spacing:.06em}
.td-c b{font:700 17px/1.2 var(--f-display)}
.td-c .meta{font-size:12px;color:var(--dim)}
.td-c.on{grid-column:1/-1;cursor:default;transform:none;border-color:rgba(212,168,79,.7)}
.td-decks{display:grid;gap:8px;margin-top:8px}
.td-d{display:flex;gap:10px;align-items:center;justify-content:space-between;background:rgba(8,14,12,.82);border:1px solid var(--line);border-radius:10px;padding:9px 12px;animation:d29in .25s both}
.td-d .t{font-size:13px}
.td-d .t span{color:var(--dim)}
.td-d .act{display:flex;gap:6px;align-items:center;flex-shrink:0}
.td-empty{grid-column:1/-1;color:var(--dim);padding:30px;text-align:center}
`;
function tdArt(n){ const a = TD.data && TD.data.art || {}; const x = a[n] || a[String(n).split(' // ')[0]]; return x || {}; }
function tdGroup(){ const d = TD.data; if (!d) return []; const g = d[TD.tab] || {}; return g.commanders || []; }
function tdName(c){ return c.name || (c.cmd || []).join(' + '); }
function tdFmtDate(s){ if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1] || ''} ${y}`; }
function tdPlace(p){ const r = String(p || '').match(/^(\d+)-(\d+)$/); if (r) return 'Top ' + r[2]; const n = parseInt(p); if (!n) return 'Top 8'; return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'; }
function tdHTML(){
  const tabs = TD_TABS.map(([t, l]) => `<button type="button" data-td-tab="${t}" aria-selected="${TD.tab === t}">${l}</button>`).join('');
  let body = '';
  if (TD.busy) body = `<div class="td-empty"><span style="display:inline-block;width:16px;height:16px;border:2px solid var(--brass);border-right-color:transparent;border-radius:50%;animation:u28spin .8s linear infinite;vertical-align:-3px;margin-right:8px"></span>Loading the top commanders…</div>`;
  else if (TD.err) body = `<div class="td-empty">${esc(TD.err)}</div>`;
  else {
    const q = norm(TD.q || ''); const list = tdGroup().map((c, i) => [c, i]).filter(([c]) => !q || norm(tdName(c) + ' ' + (c.alias || '')).includes(q));
    body = list.length ? list.map(([c, i]) => tdCardHTML(c, i)).join('') : `<div class="td-empty">No commander matches “${esc(TD.q)}”.</div>`;
  }
  const info = TD_TABS.find(t => t[0] === TD.tab)[2];
  const built = TD.data && TD.data.built ? ` · updated ${tdFmtDate(TD.data.built.slice(0, 10))}` : '';
  return `<div class="td-ov" data-td-close><div class="td-box" role="dialog" aria-label="Top commanders">
    <div class="td-head"><div><h2>Top commanders</h2><div class="hint">${esc(info)}${built}. Pick a commander, then a deck to load it.</div></div><button class="btn ghost" type="button" data-td-x>Close</button></div>
    <div class="td-bar"><div class="td-tabs" role="tablist">${tabs}</div><input type="search" id="tdQ" placeholder="Find a commander" value="${esc(TD.q)}" aria-label="Find a commander" autocomplete="off"></div>
    <div class="td-list" id="tdList">${body}</div></div></div>`;
}
function tdCardHTML(c, i){
  const nm = tdName(c); const first = (c.cmd || (c.decks || [])[0]?.cmd || [nm])[0]; const art = tdArt(first).crop || '';
  const on = TD.open === TD.tab + ':' + i;
  const meta = TD.tab === 'edhrec' ? `${c.decks ? c.decks.toLocaleString() + ' decks on EDHREC' : ''}` : `${c.count} top-8 finish${c.count === 1 ? '' : 'es'}`;
  let decks = '';
  if (on){
    if (TD.tab === 'edhrec') decks = `<div class="td-d"><div class="t"><b>Average deck</b> <span>— the cards most often played with ${esc(nm)}${c.decks ? ` across ${c.decks.toLocaleString()} decks` : ''}</span></div><div class="act"><a class="btn small ghost" href="${esc(c.url)}" target="_blank" rel="noopener">EDHREC ↗</a><button class="btn small primary" type="button" data-td-load="${i}:0">Load this deck</button></div></div>`;
    else decks = (c.decks || []).map((d, j) => `<div class="td-d" style="animation-delay:${j * 50}ms"><div class="t"><b>${tdPlace(d.place)}</b>${d.player ? ` · ${esc(d.player)}` : ''}<br><span>${esc(d.event || 'Tournament')}${d.players ? ` · ${d.players} players` : ''}${d.date ? ` · ${tdFmtDate(d.date)}` : ''}</span></div><div class="act"><a class="btn small ghost" href="${esc(d.url)}" target="_blank" rel="noopener">MTGTop8 ↗</a><button class="btn small primary" type="button" data-td-load="${i}:${j}">Load this deck</button></div></div>`).join('');
  }
  return `<div class="td-c${on ? ' on' : ''}" data-td-open="${i}" style="${art ? `background-image:url('${esc(art)}');` : ''}animation-delay:${Math.min(i, 30) * 18}ms"><div class="sh"></div><div class="in"><span class="rk">#${i + 1}</span><b>${esc(nm)}</b><span class="meta">${esc(meta)}</span>${on ? `<div class="td-decks">${decks}</div>` : ''}</div></div>`;
}
function tdRender(){ const o = document.querySelector('.td-ov'); if (!o) return; const sc = o.querySelector('#tdList')?.scrollTop || 0; const f = document.activeElement && document.activeElement.id === 'tdQ'; const caret = f && document.activeElement.selectionStart;
  o.outerHTML = tdHTML(); const n = document.querySelector('.td-ov'); const l = n.querySelector('#tdList'); if (l) l.scrollTop = sc; if (f){ const q = n.querySelector('#tdQ'); q.focus(); try { q.setSelectionRange(caret, caret); } catch {} } }
async function tdOpen(){
  if (!document.getElementById('tdcss')){ const st = document.createElement('style'); st.id = 'tdcss'; st.textContent = TD_CSS; document.head.appendChild(st); }
  document.querySelector('.td-ov')?.remove(); document.body.insertAdjacentHTML('beforeend', tdHTML());
  if (!TD.data){ TD.busy = true; TD.err = ''; tdRender();
    try { const r = await fetch(TD_URL, {cache:'no-cache'}); if (!r.ok) throw new Error('HTTP ' + r.status); TD.data = await r.json(); }
    catch (e){ TD.err = `Couldn't load the top commanders list (${e.message}). It needs internet.`; }
    TD.busy = false; tdRender(); }
}
function tdClose(){ document.querySelector('.td-ov')?.remove(); }
function tdListText(c, d){
  // the list the deck box understands: a Commander section, then the deck
  const cmd = (d ? d.cmd : c.cmd) || [];
  const main = (d ? d.main : c.main) || [];
  const cmdSet = new Set(cmd.map(n => n.toLowerCase()));
  return 'Commander\n' + cmd.map(n => '1 ' + n).join('\n') + '\n\nDeck\n' + main.filter(([, n]) => !cmdSet.has(n.toLowerCase())).map(([q, n]) => `${q} ${n}`).join('\n');
}
async function tdLoad(i, j){
  const c = tdGroup()[i]; if (!c) return; const d = TD.tab === 'edhrec' ? null : c.decks[j];
  const fmt = TD.tab === 'duel' ? 'duel' : 'cmd';
  tdClose();
  if (typeof lobbyPage === 'function') lobbyPage('decks');
  const fb = document.querySelector(`#fmtSeg [data-fmt="${fmt}"]`); if (fb && fb.getAttribute('aria-pressed') !== 'true') fb.click();
  const ta = document.getElementById('deckIn'); ta.value = tdListText(c, d); ta.dispatchEvent(new Event('input', {bubbles:true}));
  LOBBY.tdName = TD.tab === 'edhrec' ? `${tdName(c)} — EDHREC average deck` : `${tdName(c)} — ${tdPlace(d.place)}${d.player ? ', ' + d.player : ''}${d.date ? ' (' + tdFmtDate(d.date) + ')' : ''}`;
  document.getElementById('loadBtn').click();
}
// name the loaded deck after where it came from (only for the load started from the picker)
{ const prev = typeof renderDeckSum === 'function' ? renderDeckSum : null;
  if (prev) renderDeckSum = function(){ try { if (LOBBY.tdName && LOBBY.deck && !LOBBY.deck.tdNamed){ LOBBY.deck.tdNamed = 1; if (!LOBBY.deckName) LOBBY.deckName = LOBBY.tdName; LOBBY.tdName = null; } } catch {} return prev.apply(this, arguments); }; }
document.addEventListener('click', e => {
  const t = e.target.closest('[data-td-tab],[data-td-open],[data-td-load],[data-td-x],[data-td-close],[data-td-btn]'); if (!t) return;
  if (t.hasAttribute('data-td-btn')){ tdOpen(); return; }
  if (t.hasAttribute('data-td-x')){ tdClose(); return; }
  if (t.hasAttribute('data-td-close')){ if (e.target === t) tdClose(); return; }
  if (t.dataset.tdTab){ TD.tab = t.dataset.tdTab; TD.open = null; tdRender(); return; }
  if (t.dataset.tdLoad){ e.stopPropagation(); const [i, j] = t.dataset.tdLoad.split(':').map(Number); tdLoad(i, j); return; }
  if (t.dataset.tdOpen != null && !e.target.closest('a,button')){ const k = TD.tab + ':' + t.dataset.tdOpen; TD.open = TD.open === k ? null : k; tdRender(); }
});
document.addEventListener('input', e => { if (e.target.id === 'tdQ'){ TD.q = e.target.value; TD.open = null; tdRender(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.td-ov')) tdClose(); });
// the button on the Decks page
{ const row = document.getElementById('sampleBtn')?.parentNode;
  if (row){ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.tdBtn = '1'; b.innerHTML = '★ Top commanders'; b.title = 'Pick one of the most-played commanders and load a real tournament deck (MTGTop8) or EDHREC’s average deck'; row.insertBefore(b, document.getElementById('sampleBtn')); } }
