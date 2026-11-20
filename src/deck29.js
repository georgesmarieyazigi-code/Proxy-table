/* ===== deck29: the Deck Workshop — Build / Deck / Test, animated (Edit & test page) =====
   Artwork and the moving header are Higgsfield generations made for Proxy Table (original designs).
   Everything the old editor did still works (same data-de actions); this is a new face on top of it. */
const D29_ART = {
  banner:'https://d8j0ntlcm91z4.cloudfront.net/user_3MBpZ643qhHhGn8CmuuGhr7oLkU/hf_20261117_214351_cb02d3a9-9d89-4e76-8481-f04fcc81a7e0.png',
  video:'https://d8j0ntlcm91z4.cloudfront.net/user_3MBpZ643qhHhGn8CmuuGhr7oLkU/hf_20261117_214437_237b3cb5-6ef5-4516-aa7b-275d4f94e0ae.mp4',
};
const DE29 = {tab:'deck', view:'visual', q:'', res:[], busy:false, total:0, type:'', mine:true, sort:'edhrec', flash:null, map:new Map(), qn:0, lastCount:null};
try { const s = JSON.parse(localStorage.getItem('pt.d29') || '{}'); if (s.view) DE29.view = s.view; if (s.tab) DE29.tab = s.tab; if (typeof s.mine === 'boolean') DE29.mine = s.mine; } catch {}
const d29save = () => { try { localStorage.setItem('pt.d29', JSON.stringify({view:DE29.view, tab:DE29.tab, mine:DE29.mine})); } catch {} };

const D29_CSS = `
#deckEdit .d29{position:relative;display:grid;gap:14px}
#d29top{margin:4px 0 14px}
/* hero */
.d29hero{position:relative;height:250px;border-radius:16px;overflow:hidden;border:1px solid rgba(212,168,79,.35);background:#0c1712 var(--d29banner) left center/cover no-repeat;box-shadow:0 18px 40px rgba(0,0,0,.45)}
.d29hero video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:left center;opacity:0;transition:opacity 1.2s}
.d29hero video.on{opacity:1}
.d29hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,14,12,0) 22%,rgba(8,14,12,.55) 46%,rgba(8,14,12,.92) 70%);pointer-events:none}
.d29info{position:absolute;z-index:2;right:22px;top:18px;bottom:18px;left:44%;display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center}
.d29cmdr{width:128px;aspect-ratio:63/88;border-radius:9px;background:#0e2318 center/cover;box-shadow:0 12px 30px rgba(0,0,0,.6),0 0 0 1px rgba(212,168,79,.6),0 0 30px rgba(212,168,79,.25);transform:perspective(700px) rotateY(-14deg) rotateX(4deg);transition:transform .25s ease-out;display:grid;place-items:center;color:var(--dim);font-size:12px;text-align:center;padding:6px}
.d29cmdr.two{position:relative}
.d29cmdr.two i{position:absolute;inset:0;border-radius:9px;background:center/cover;transform:translate(26px,10px) rotate(6deg);z-index:-1;box-shadow:0 10px 24px rgba(0,0,0,.5)}
.d29meta h3{margin:0 0 4px;font:700 26px/1.1 var(--f-display);text-shadow:0 2px 12px rgba(0,0,0,.9)}
.d29meta .sub{color:var(--dim);font-size:13px;margin-bottom:10px}
.d29nums{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.d29ring{position:relative;width:74px;height:74px}
.d29ring svg{transform:rotate(-90deg)}
.d29ring circle{fill:none;stroke-width:7}
.d29ring .bg{stroke:rgba(255,255,255,.08)}
.d29ring .fg{stroke:var(--brass);stroke-linecap:round;transition:stroke-dashoffset .8s cubic-bezier(.2,.9,.3,1),stroke .3s;filter:drop-shadow(0 0 6px rgba(212,168,79,.6))}
.d29ring.over .fg{stroke:var(--bad)}.d29ring.done .fg{stroke:var(--good)}
.d29ring b{position:absolute;inset:0;display:grid;place-items:center;font:800 21px/1 var(--f-display)}
.d29ring small{position:absolute;left:0;right:0;bottom:-16px;text-align:center;font-size:11px;color:var(--dim)}
.d29ring.pulse{animation:d29pulse .5s}
@keyframes d29pulse{40%{transform:scale(1.14)}}
.d29stat{display:grid;gap:2px;font-size:12px;color:var(--dim)}
.d29stat b{font:700 18px/1 var(--f-display);color:var(--ink)}
.d29ci{display:flex;gap:4px}
/* tabs */
.d29tabs{position:relative;display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(8,14,12,.7);border:1px solid var(--line);width:max-content;margin:0 auto}
.d29tabs button{position:relative;z-index:1;border:0;background:none;color:var(--dim);font:600 15px/1 var(--f-body);padding:10px 22px;border-radius:999px;cursor:pointer;transition:color .2s}
.d29tabs button{transition:color .2s,background .25s,box-shadow .25s}
.d29tabs button[aria-selected="true"]{color:var(--brass-ink);background:var(--brass);box-shadow:0 0 18px rgba(212,168,79,.45)}
.d29tabs .ind{display:none}
.d29tabs .ind{position:absolute;top:4px;bottom:4px;border-radius:999px;background:var(--brass);box-shadow:0 0 18px rgba(212,168,79,.45);transition:left .3s cubic-bezier(.2,.9,.3,1.1),width .3s}
.d29pane{animation:d29in .35s both}
@keyframes d29in{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}
/* build */
.d29search{display:grid;gap:8px}
.d29search .bar{display:flex;gap:8px;align-items:center}
.d29search .bar input[type=text]{flex:1;font-size:16px;padding:12px 14px;border-radius:12px}
.d29chips{display:flex;gap:6px;flex-wrap:wrap}
.d29chips button{border-radius:999px;padding:4px 11px;font-size:13px;background:var(--panel-2);border:1px solid var(--line);color:var(--ink);cursor:pointer;transition:all .15s}
.d29chips button[aria-pressed="true"]{background:var(--brass);color:var(--brass-ink);border-color:var(--brass)}
.d29grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.d29res{position:relative;border-radius:10px;cursor:pointer;animation:d29deal .4s both;transition:transform .2s cubic-bezier(.2,.9,.3,1.3)}
.d29res img{width:100%;aspect-ratio:63/88;border-radius:9px;display:block;box-shadow:0 8px 18px rgba(0,0,0,.45);background:#0e2318}
.d29res:hover{transform:translateY(-6px) scale(1.04);z-index:2}
.d29res .add{position:absolute;right:8px;bottom:8px;width:38px;height:38px;border-radius:50%;border:0;background:var(--brass);color:var(--brass-ink);font:800 22px/1 var(--f-body);box-shadow:0 4px 14px rgba(0,0,0,.6);opacity:0;transform:scale(.6);transition:all .2s;cursor:pointer}
.d29res:hover .add,.d29res:focus-within .add{opacity:1;transform:none}
.d29res .have{position:absolute;left:8px;top:8px;padding:2px 8px;border-radius:999px;background:rgba(8,14,12,.9);color:var(--good);font-size:12px;font-weight:700}
.d29res .nm{display:none;padding:8px;border-radius:9px;aspect-ratio:63/88;background:var(--panel-2);font-size:13px}
@keyframes d29deal{0%{opacity:0;transform:translateY(18px) rotate(-3deg) scale(.92)}100%{opacity:1;transform:none}}
.d29fly{position:fixed;z-index:200;border-radius:8px;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.6);transition:all .7s cubic-bezier(.5,0,.2,1)}
/* deck area */
.d29tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between}
.d29tools input{max-width:260px}
.d29seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}
.d29seg button{border:0;background:none;color:var(--dim);padding:6px 14px;cursor:pointer}
.d29seg button[aria-pressed="true"]{background:var(--panel-2);color:var(--ink)}
.d29cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:18px;align-items:start}
.d29col h4{margin:0 0 8px;font:700 15px/1.2 var(--f-display);display:flex;justify-content:space-between;color:var(--brass)}
.d29col h4 span{color:var(--dim);font-family:var(--f-body)}
.d29stack{display:flex;flex-direction:column}
.d29card{position:relative;margin-top:-118%;transition:transform .22s cubic-bezier(.2,.9,.3,1.3),margin .22s;animation:d29drop .4s both}
.d29card:first-child{margin-top:0}
.d29card img,.d29card .ph{width:100%;aspect-ratio:63/88;border-radius:9px;display:block;box-shadow:0 -2px 10px rgba(0,0,0,.55);background:#0e2318}
.d29card .ph{padding:8px;font-size:12px;border:1px solid var(--line)}
.d29stack:hover .d29card{margin-top:-104%}
.d29stack:hover .d29card:first-child{margin-top:0}
.d29card:hover{transform:translateX(10px) scale(1.03);z-index:3}
.d29card .q{position:absolute;right:6px;top:6px;min-width:26px;height:26px;padding:0 6px;border-radius:999px;background:rgba(8,14,12,.92);color:var(--brass);font:800 14px/26px var(--f-body);text-align:center;box-shadow:0 0 0 1px rgba(212,168,79,.5)}
.d29card .ctl{position:absolute;left:6px;right:6px;top:5px;display:flex;gap:3px;justify-content:flex-end;opacity:0;transform:translateY(-4px);transition:all .18s}
.d29card:hover .ctl,.d29card:focus-within .ctl{opacity:1;transform:none}
.d29card:hover .q{opacity:0}
.d29card .ctl button{border:0;border-radius:7px;padding:3px 7px;font-size:13px;background:rgba(8,14,12,.92);color:var(--ink);font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.d29card .ctl button:hover{background:var(--brass);color:var(--brass-ink)}
.d29card.off img{box-shadow:0 0 0 2px var(--bad),0 -2px 10px rgba(0,0,0,.55)}
.d29card.off::after{content:"outside your colours";position:absolute;left:8px;top:34px;font-size:10px;padding:2px 6px;border-radius:6px;background:var(--bad);color:#fff}
.d29card.new img{animation:d29glow 1.4s}
@keyframes d29glow{0%{box-shadow:0 0 0 3px var(--brass),0 0 30px var(--brass)}100%{box-shadow:0 -2px 10px rgba(0,0,0,.55)}}
.d29card.out{transform:scale(.6) translateX(40px);opacity:0;transition:all .22s}
@keyframes d29drop{0%{opacity:0;transform:translateY(-14px)}100%{opacity:1;transform:none}}
.d29list .de-row{animation:d29in .25s both}
/* peek */
.d29peek{position:fixed;inset:0;z-index:140;display:grid;place-items:center;background:rgba(4,8,6,.7);backdrop-filter:blur(4px);animation:u28fade .2s both}
.d29peek .in{display:grid;grid-template-columns:300px 340px;gap:20px;background:var(--panel);border:1px solid rgba(212,168,79,.5);border-radius:16px;padding:18px;box-shadow:0 30px 70px rgba(0,0,0,.7);animation:d29zoom .3s cubic-bezier(.2,.9,.3,1.25) both}
.d29peek img{width:300px;border-radius:14px}
@keyframes d29zoom{0%{opacity:0;transform:scale(.85) rotate(-2deg)}100%{opacity:1;transform:none}}
/* test */
.d29test{display:grid;gap:14px}
.d29test .de-curve .bar span{transform-origin:bottom;animation:d29grow .7s cubic-bezier(.2,.9,.3,1.2) both}
.d29test .de-curve .bar:nth-child(2) span{animation-delay:.05s}.d29test .de-curve .bar:nth-child(3) span{animation-delay:.1s}.d29test .de-curve .bar:nth-child(4) span{animation-delay:.15s}.d29test .de-curve .bar:nth-child(5) span{animation-delay:.2s}.d29test .de-curve .bar:nth-child(6) span{animation-delay:.25s}.d29test .de-curve .bar:nth-child(7) span{animation-delay:.3s}.d29test .de-curve .bar:nth-child(8) span{animation-delay:.35s}
@keyframes d29grow{0%{transform:scaleY(0)}100%{transform:none}}
.d29test .de-hand img,.d29test .de-hand .de-txt{animation:d29deal .45s both}
.d29test .de-hand > :nth-child(2){animation-delay:.06s}.d29test .de-hand > :nth-child(3){animation-delay:.12s}.d29test .de-hand > :nth-child(4){animation-delay:.18s}.d29test .de-hand > :nth-child(5){animation-delay:.24s}.d29test .de-hand > :nth-child(6){animation-delay:.3s}.d29test .de-hand > :nth-child(7){animation-delay:.36s}.d29test .de-hand > :nth-child(n+8){animation-delay:.1s}
.d29test .de-hand img{transition:transform .2s}.d29test .de-hand img:hover{transform:translateY(-10px) scale(1.06)}
html:not(.u28fx) .d29 *{animation:none!important;transition:none!important}
`;

function d29ci(d){ const s = new Set(); (d.cmd || []).forEach(k => String(info(k)?.ci || '').split('').forEach(c => s.add(c))); return [...s].join(''); }
function d29img(k){ const a = info(k) || {}; return a.img || ''; }
function d29html(d){
  const total = deckCount(d), target = LOBBY.fmt === 'std' ? 60 : 100, st = deStats(d), ci = d29ci(d), pr = typeof deckPrice === 'function' ? deckPrice(d) : {t:0};
  const R = 32, C = 2 * Math.PI * R, frac = Math.min(1, total / target);
  const cm = d.cmd.map(k => d29img(k)).filter(Boolean);
  const name = LOBBY.deckName || d.cmd.map(k => info(k)?.n).filter(Boolean).join(' + ') || 'Your deck';
  const tabs = [['build', 'Build'], ['deck', 'Deck'], ['test', 'Test']];
  return {hero:`<div class="d29hero" id="d29hero">${D29_ART.video && document.documentElement.classList.contains('u28fx') ? `<video id="d29vid" muted loop playsinline autoplay preload="auto" poster="${esc(D29_ART.banner)}" src="${esc(D29_ART.video)}"></video>` : ''}
    <div class="d29info">
      <div class="d29cmdr${cm.length > 1 ? ' two' : ''}" id="d29cmdr" style="${cm[0] ? `background-image:url('${esc(cm[0])}')` : ''}">${cm[1] ? `<i style="background-image:url('${esc(cm[1])}')"></i>` : ''}${cm.length ? '' : d.cmd.length ? esc(d.cmd.map(k => info(k)?.n || '').join(' + ')) : (FMT[LOBBY.fmt].cz ? 'Pick a commander<br>★ on any legendary creature' : '')}</div>
      <div class="d29meta"><h3>${esc(name)}</h3><div class="sub">${esc(FMT[LOBBY.fmt]?.label || '')}${pr.t ? ` · about $${pr.t.toFixed(0)} to buy` : ''}</div>
        <div class="d29nums">
          <div class="d29ring${total > target ? ' over' : total === target ? ' done' : ''}" id="d29ring" title="${total} of ${target} cards"><svg width="74" height="74"><circle class="bg" cx="37" cy="37" r="${R}"/><circle class="fg" cx="37" cy="37" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/></svg><b>${total}</b><small>of ${target}</small></div>
          <div class="d29stat"><b>${st.lands}</b>lands</div><div class="d29stat"><b>${st.avg.toFixed(2)}</b>avg mana value</div>
          ${ci ? `<div class="d29stat"><span class="d29ci">${manaHTML(ci.split('').map(c => '{' + c + '}').join(''))}</span>colours</div>` : ''}
        </div></div></div></div>`, body:`<div class="d29">
  <div class="d29tabs" role="tablist" id="d29tabs">${tabs.map(([t, l]) => `<button type="button" role="tab" data-d29tab="${t}" aria-selected="${DE29.tab === t}">${l}</button>`).join('')}<span class="ind"></span></div>
  <div id="d29body"></div>
</div>`};
}
function d29buildHTML(d){
  const ci = d29ci(d); const types = ['', 'creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker', 'land'];
  return `<div class="d29pane d29search">
    <div class="bar"><input type="text" id="deAddIn" list="deSugg" placeholder="Search Scryfall: a name, or words like “flying dragon”, or o:draw t:creature" autocomplete="off" spellcheck="false" aria-label="Search for a card to add" value="${esc(DE29.q)}"><datalist id="deSugg"></datalist>
      <input type="number" id="deAddQ" min="1" max="99" value="1" aria-label="How many" style="width:64px"><button class="btn primary" type="button" data-de="add" title="Add the card with exactly this name">Add</button></div>
    <div class="d29chips">${types.map(t => `<button type="button" data-d29type="${t}" aria-pressed="${DE29.type === t}">${t ? t[0].toUpperCase() + t.slice(1) : 'Any type'}</button>`).join('')}
      ${ci && FMT[LOBBY.fmt].cz ? `<button type="button" data-d29mine aria-pressed="${DE29.mine}">Only ${manaHTML(ci.split('').map(c => '{' + c + '}').join(''))}</button>` : ''}</div>
    <div class="status" id="deStatus" role="status"></div>
    <div id="d29res">${d29resHTML()}</div></div>`;
}
function d29resHTML(){
  if (DE29.busy && !DE29.res.length) return `<div class="hint"><span class="spin" style="display:inline-block;width:14px;height:14px;border:2px solid var(--brass);border-right-color:transparent;border-radius:50%;animation:u28spin .8s linear infinite;vertical-align:-2px;margin-right:6px"></span>Searching Scryfall…</div>`;
  if (!DE29.q) return `<div class="hint">Type above to search every Magic card. Most-played cards come first; tap <b>+</b> to put one in your deck.</div>`;
  if (!DE29.res.length) return `<div class="hint">No cards found.</div>`;
  const d = LOBBY.deck; const have = new Map((d ? d.main : []).map(e => [norm(info(e.k)?.n || ''), e.q]));
  return `<div class="hint" style="margin-bottom:8px">${DE29.total} card${DE29.total === 1 ? '' : 's'} on Scryfall${DE29.total > DE29.res.length ? ` — showing the ${DE29.res.length} most played` : ''}</div><div class="d29grid">${DE29.res.map((c, i) => {
    const img = (c.image_uris && c.image_uris.normal) || (c.card_faces && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal) || ''; const h = have.get(norm(c.name));
    return `<div class="d29res" style="animation-delay:${Math.min(i, 24) * 30}ms" data-d29peek="${esc(c.id)}">${img ? `<img src="${esc(safeImg(img))}" alt="${esc(c.name)}" loading="lazy">` : `<div class="nm" style="display:block">${esc(c.name)}</div>`}${h ? `<span class="have">×${h} in deck</span>` : ''}<button type="button" class="add" data-d29add="${esc(c.id)}" title="Add ${esc(c.name)}" aria-label="Add ${esc(c.name)}">+</button></div>`; }).join('')}</div>`;
}
function d29deckHTML(d){
  const ci = d29ci(d), f = DE.filter.toLowerCase();
  const order = ['Creature', 'Planeswalker', 'Battle', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Other'];
  const groups = {}; d.main.forEach(e => { const a = info(e.k); if (!a || (f && !a.n.toLowerCase().includes(f))) return; const g = deTypeOf(e.k); (groups[g] = groups[g] || []).push(e); });
  const off = k => ci && FMT[LOBBY.fmt].cz && String(info(k)?.ci || '').split('').some(c => !ci.includes(c));
  const card = (e, cmd) => { const a = info(e.k) || {n:'?'};
    return `<div class="d29card${off(e.k) ? ' off' : ''}${DE29.flash === e.k ? ' new' : ''}" data-k="${esc(e.k)}">${a.img ? `<img src="${esc(a.img)}" alt="${esc(a.n)}" loading="lazy">` : `<div class="ph"><b>${esc(a.n)}</b><br>${manaHTML(a.m || '')}<div class="hint">${esc(a.t || '')}</div></div>`}
      ${cmd || e.q < 2 ? '' : `<span class="q">×${e.q}</span>`}<div class="ctl">${cmd ? `<button type="button" data-de="uncmd" data-k="${esc(e.k)}" title="Move into the deck">↓</button>` : `<button type="button" data-de="minus" data-k="${esc(e.k)}" title="One fewer" aria-label="One fewer">−</button><button type="button" data-de="plus" data-k="${esc(e.k)}" title="One more" aria-label="One more">+</button>${a.cc && FMT[LOBBY.fmt].cz ? `<button type="button" data-de="cmd" data-k="${esc(e.k)}" title="Make this your commander">★</button>` : ''}<button type="button" data-de="del" data-k="${esc(e.k)}" title="Remove all copies" aria-label="Remove">✕</button>`}<button type="button" data-de="peek" data-k="${esc(e.k)}" title="Look at the card" aria-label="Look">⤢</button></div></div>`; };
  const cols = (d.cmd.length ? [['Commander', d.cmd.map(k => ({k, q:1})), true]] : []).concat(order.filter(g => groups[g]).map(g => [g === 'Sorcery' ? 'Sorceries' : g === 'Other' ? 'Other' : g + 's', groups[g].slice().sort((x, y) => (info(x.k)?.mv || 0) - (info(y.k)?.mv || 0) || (info(x.k)?.n || '').localeCompare(info(y.k)?.n || '')), false]));
  const visual = `<div class="d29cols">${cols.map(([t, list, cmd]) => `<div class="d29col"><h4>${esc(t)} <span>${list.reduce((s, e) => s + e.q, 0)}</span></h4><div class="d29stack">${list.map(e => card(e, cmd)).join('')}</div></div>`).join('')}</div>`;
  const row = e => { const a = info(e.k) || {n:'?'}; return `<div class="de-row" data-k="${esc(e.k)}"><span class="de-q"><button type="button" class="btn small ghost" data-de="minus" data-k="${esc(e.k)}" aria-label="One fewer">−</button><b>${e.q}</b><button type="button" class="btn small ghost" data-de="plus" data-k="${esc(e.k)}" aria-label="One more">+</button></span><span class="de-n" data-de="peek" data-k="${esc(e.k)}">${esc(a.n)}</span><span class="de-m">${manaHTML(a.m || '')}</span>${a.cc && FMT[LOBBY.fmt].cz ? `<button type="button" class="btn small ghost" data-de="cmd" data-k="${esc(e.k)}" title="Make this your commander">★</button>` : ''}<button type="button" class="btn small ghost" data-de="del" data-k="${esc(e.k)}" title="Remove all copies">✕</button></div>`; };
  const list = `<div class="de-cols d29list">${d.cmd.length ? `<div class="de-grp"><div class="label">Commander</div>${d.cmd.map(k => `<div class="de-row"><span class="de-q"><b>1</b></span><span class="de-n" data-de="peek" data-k="${esc(k)}">${esc(info(k)?.n || '?')}</span><span class="de-m">${manaHTML(info(k)?.m || '')}</span><button type="button" class="btn small ghost" data-de="uncmd" data-k="${esc(k)}" title="Move into the deck">↓</button></div>`).join('')}</div>` : ''}${cols.filter(c => !c[2]).map(([t, l]) => `<div class="de-grp"><div class="label">${esc(t)} (${l.reduce((s, e) => s + e.q, 0)})</div>${l.map(row).join('')}</div>`).join('')}</div>`;
  return `<div class="d29pane"><div class="d29tools"><input type="text" id="deFilter" placeholder="Find in deck" value="${esc(DE.filter)}" aria-label="Find in deck">
    <span class="hint">${LOBBY.deckEdited ? '<b>Edited</b> — press Save above to keep the changes' : 'Hover a card for − + ★ ✕ · ★ makes it your commander'}</span>
    <span class="d29seg" role="group" aria-label="View"><button type="button" data-d29view="visual" aria-pressed="${DE29.view === 'visual'}">Cards</button><button type="button" data-d29view="list" aria-pressed="${DE29.view === 'list'}">List</button></span></div>
    ${DE29.view === 'visual' ? visual : list}<div id="d29extra"></div></div>`;
}
function d29peekHTML(){ const k = DE.peek, a = k && info(k); if (!a) return '';
  return `<div class="d29peek" data-d29close><div class="in"><img src="${esc(a.img || '')}" alt="${esc(a.n)}"><div><h3 style="margin:0 0 6px;font:700 24px/1.2 var(--f-display)">${esc(a.n)} ${manaHTML(a.m || '')}</h3><div class="hint">${esc(a.t || '')}</div><div class="de-otxt" style="margin:10px 0;white-space:pre-wrap">${esc(a.o || '')}</div>
    <div class="row"><button class="btn small" type="button" data-u28askcard="${esc(a.n)}">Rulings ✦</button><button class="btn small ghost" type="button" data-de="peek" data-k="${esc(k)}">Close</button></div></div></div></div>`; }

// Render: the old editor still builds its parts (and the deck-rules / companion section); we keep its test section
// and the rules section, and put the new workshop around them.
{ const prev = renderDeckEdit;
  renderDeckEdit = function(){
    const r = prev.apply(this, arguments);
    try {
      const el = $('#deckEdit'); const d = LOBBY.deck; const top0 = document.getElementById('d29top');
      if (!el || el.hidden || !d){ if (top0) top0.hidden = true; return r; }
      const secs = [...el.querySelectorAll(':scope > .de-sec')];
      const rules = secs.find(s => s.classList.contains('t25sec')); const test = secs.find(s => /Test the deck/.test(s.querySelector('h3')?.textContent || ''));
      const focus = document.activeElement && document.activeElement.id; const caret = focus && document.activeElement.selectionStart;
      const H = d29html(d); el.innerHTML = H.body;
      let top = document.getElementById('d29top'); if (!top){ top = document.createElement('div'); top.id = 'd29top'; el.parentNode.insertBefore(top, $('#deckSum') || el); }
      if (top.querySelector('#d29hero') && !!top.querySelector('#d29vid') === !!(D29_ART.video && document.documentElement.classList.contains('u28fx'))){ const t = document.createElement('div'); t.innerHTML = H.hero; top.querySelector('.d29info').replaceWith(t.querySelector('.d29info')); }
      else top.innerHTML = H.hero;
      top.hidden = false;
      { const fg = top.querySelector('#d29ring .fg'); if (fg){ const to = fg.getAttribute('stroke-dashoffset'); if (DE29.lastOff != null && DE29.lastOff !== to){ fg.style.transition = 'none'; fg.style.strokeDashoffset = DE29.lastOff; requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.transition = ''; fg.style.strokeDashoffset = to; })); } DE29.lastOff = to; } }
      const body = el.querySelector('#d29body');
      if (DE29.tab === 'build') body.innerHTML = d29buildHTML(d);
      else if (DE29.tab === 'test'){ body.innerHTML = '<div class="d29pane d29test"></div>'; if (test){ test.querySelector('h3')?.remove(); body.firstChild.appendChild(test); } }
      else { body.innerHTML = d29deckHTML(d); if (rules) body.querySelector('#d29extra').appendChild(rules); }
      if (DE.peek) el.insertAdjacentHTML('beforeend', d29peekHTML());
      d29after(el, d);
      if (focus){ const f = document.getElementById(focus); if (f && f.closest('#deckEdit')){ f.focus(); try { f.setSelectionRange(caret, caret); } catch {} } }
    } catch (e){ console.warn('d29 render', e); }
    return r; }; }
function d29after(el, d){
  // tab indicator
  const tabs = el.querySelector('#d29tabs'), on = tabs.querySelector('[aria-selected="true"]'), ind = tabs.querySelector('.ind');
  if (on) requestAnimationFrame(() => { ind.style.left = on.offsetLeft + 'px'; ind.style.width = on.offsetWidth + 'px'; });
  // looping video: only show it once it actually plays (otherwise the banner art stays)
  const v = document.querySelector('#d29vid'); if (v && !v.__d29){ v.__d29 = 1; const on = () => { if (v.readyState >= 2 && !v.error) v.classList.add('on'); };
    v.addEventListener('playing', on); v.addEventListener('error', () => v.classList.remove('on')); v.play().then(on).catch(() => {}); on(); }
  // count ring pulses when the count changes
  const n = deckCount(d); if (DE29.lastCount !== null && n !== DE29.lastCount){ const r = document.querySelector('#d29ring'); if (r){ r.classList.add('pulse'); } } DE29.lastCount = n;
  if (DE29.flash) setTimeout(() => { DE29.flash = null; }, 1500);
  // commander card tilts with the mouse
  const hero = document.querySelector('#d29hero'), cm = document.querySelector('#d29cmdr');
  if (hero && cm) hero.onmousemove = e => { const b = hero.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5; cm.style.transform = `perspective(700px) rotateY(${-14 + x * 22}deg) rotateX(${4 - y * 16}deg)`; };
}
async function d29search(){
  const my = ++DE29.qn; const q = DE29.q.trim(); if (!q){ DE29.res = []; DE29.busy = false; d29paintRes(); return; }
  DE29.busy = true; d29paintRes(); await sleep(350); if (my !== DE29.qn) return;
  const d = LOBBY.deck, ci = d ? d29ci(d) : '';
  let qq = q; if (DE29.type) qq += ` t:${DE29.type}`; if (DE29.mine && ci && FMT[LOBBY.fmt].cz) qq += ` id<=${ci}`; if (FMT[LOBBY.fmt].cz) qq += ' f:commander';
  try { const r = await sf('/cards/search?order=edhrec&unique=cards&q=' + encodeURIComponent(qq)); if (my !== DE29.qn) return;
    DE29.res = (r && r.data || []).slice(0, 60); DE29.total = (r && r.total_cards) || DE29.res.length; DE29.res.forEach(c => DE29.map.set(c.id, c));
  } catch { if (my !== DE29.qn) return; DE29.res = []; DE29.total = 0; }
  DE29.busy = false; d29paintRes();
}
function d29paintRes(){ const r = document.getElementById('d29res'); if (r) r.innerHTML = d29resHTML(); }
async function d29addCard(id, from){
  const c = DE29.map.get(id); if (!c) return;
  try { const a = infoFrom(c); if (!DICT.has(a.k)) DICT.set(a.k, a); try { await ensureTokens((a.toks || []).map(t => t.id)); } catch {}
    // the card flies into the deck
    const img = from && from.querySelector('img'), ring = document.getElementById('d29ring');
    if (img && ring && document.documentElement.classList.contains('u28fx')){ const b = img.getBoundingClientRect(), t = ring.getBoundingClientRect(); const f = img.cloneNode(); f.className = 'd29fly'; Object.assign(f.style, {left:b.left + 'px', top:b.top + 'px', width:b.width + 'px'}); document.body.appendChild(f);
      requestAnimationFrame(() => Object.assign(f.style, {left:(t.left + t.width / 2 - 20) + 'px', top:(t.top + t.height / 2 - 28) + 'px', width:'40px', opacity:'.2', transform:'rotate(18deg)'})); setTimeout(() => f.remove(), 750); }
    DE29.flash = a.k; deAdd(a.k, 1); deStatus(`Added ${a.n}`, 'ok'); d29paintRes();
  } catch (e){ deStatus(`Couldn't add that card: ${e.message}`, 'err'); }
}
// clicks and typing
document.addEventListener('click', e => {
  const t = e.target.closest('[data-d29tab],[data-d29view],[data-d29type],[data-d29mine],[data-d29add],[data-d29close],[data-u28askcard],[data-d29peek]'); if (!t || !t.closest('#deckEdit')) return;
  if (t.dataset.d29tab){ DE29.tab = t.dataset.d29tab; d29save(); renderDeckEdit(); if (DE29.tab === 'build') setTimeout(() => $('#deAddIn')?.focus(), 30); return; }
  if (t.dataset.d29view){ DE29.view = t.dataset.d29view; d29save(); renderDeckEdit(); return; }
  if (t.dataset.d29type !== undefined){ DE29.type = t.dataset.d29type; renderDeckEdit(); d29search(); return; }
  if (t.hasAttribute('data-d29mine')){ DE29.mine = !DE29.mine; d29save(); renderDeckEdit(); d29search(); return; }
  if (t.dataset.d29add){ e.stopPropagation(); d29addCard(t.dataset.d29add, t.closest('.d29res')); return; }
  if (t.dataset.u28askcard){ DE.peek = null; renderDeckEdit(); if (typeof u28askOpen === 'function'){ u28askOpen(); document.getElementById('u28q').value = `Rulings for "${t.dataset.u28askcard}"`; u28askRun(); } return; }
  if (t.hasAttribute('data-d29close') && e.target === t){ DE.peek = null; renderDeckEdit(); return; }
});
// removing a card: let it slide out first
document.addEventListener('click', e => {
  const b = e.target.closest('#deckEdit .d29card [data-de="del"], #deckEdit .d29card [data-de="minus"]'); if (!b || b.dataset.d29go) return;
  const card = b.closest('.d29card'); const d = LOBBY.deck; const ent = d && d.main.find(x => x.k === b.dataset.k);
  if (!card || !ent || (b.dataset.de === 'minus' && ent.q > 1) || !document.documentElement.classList.contains('u28fx')) return;
  e.stopImmediatePropagation(); e.preventDefault(); card.classList.add('out');
  setTimeout(() => { b.dataset.d29go = '1'; b.click(); }, 200);
}, true);
document.addEventListener('input', e => {
  if (e.target.id === 'deAddIn' && e.target.closest('#deckEdit')){ DE29.q = e.target.value; d29search(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && DE.peek && document.querySelector('.d29peek')){ DE.peek = null; renderDeckEdit(); } });
// install
(function(){ const st = document.createElement('style'); st.id = 'd29css'; st.textContent = D29_CSS; document.head.appendChild(st);
  const i = new Image(); i.onload = () => document.documentElement.style.setProperty('--d29banner', `url("${D29_ART.banner}")`); i.referrerPolicy = 'no-referrer'; i.src = D29_ART.banner; })();
