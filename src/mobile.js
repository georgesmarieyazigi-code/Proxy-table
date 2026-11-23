/* ===== mobile: a real phone layout (≤ 760px wide) + quicker card actions everywhere =====
   Phone: compact top bar that scrolls sideways, opponents as slim rows, your battlefield flowing in rows (creatures,
   other permanents, lands — no overlapping cards), your hand docked at the bottom, the card menu as a bottom sheet with
   big buttons, the log behind a button.
   Everywhere: a card's mana colours are buttons right in its menu (one tap instead of two), and the quick action
   (double-click / T) on a fetch land or other "{T}: …" permanent uses its ability instead of just turning it sideways. */
const MOB_CSS = `
#menu .ms{display:inline-grid!important;width:auto!important;min-width:1.35em;flex:none!important;vertical-align:-2px}
#menu button[data-act="actAb"] > span{display:block;text-align:left}
@media (max-width:760px){
  body.ptg{overflow:auto}
  #game{display:flex!important;flex-direction:column;height:auto!important;min-height:100dvh;padding-bottom:0}
  #topbar{position:sticky;top:0;z-index:45;display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;padding:6px 8px!important;background:rgba(8,14,12,.96);backdrop-filter:blur(6px);scrollbar-width:none;-webkit-overflow-scrolling:touch}
  #topbar::-webkit-scrollbar{display:none}
  #topbar > *{flex:none!important}
  #topbar .btn{padding:7px 11px!important;font-size:13px!important;white-space:nowrap}
  #topbar .u28logo, #topbar .logo, #topbar h1{font-size:16px!important;margin:0!important}
  #topbar .u28logo, #topbar .logo{display:none!important}
  #phasebar{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:6px;padding:6px 8px!important;overflow:hidden;position:sticky;top:46px;z-index:44;background:rgba(8,14,12,.96)}
  #phasebar[hidden]{display:none!important}
  #phasebar .phwho{font-size:14px!important;white-space:nowrap;flex:none}
  #phasebar .phchips{display:flex;flex-wrap:nowrap;gap:0}
  #phasebar .phc{display:none!important}
  #phasebar .phc.on{display:inline-block!important;font-size:12px;padding:3px 9px!important}
  #phasebar .waittxt{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #phasebar .spacer{flex:1}
  #phasebar .btn{flex:none;padding:7px 12px!important;font-size:13px!important}
  #phasebar::-webkit-scrollbar{display:none}
  #table{display:block!important}
  #opps{display:flex!important;flex-direction:column;gap:6px;padding:6px!important}
  .opp{height:auto!important;min-height:0!important}
  .opp header{padding:6px 10px!important;gap:8px;font-size:13px;flex-wrap:wrap}
  .opp .lifebadge{font-size:20px!important}
  .opp .obf{display:flex!important;flex-wrap:nowrap;overflow-x:auto;gap:4px;min-height:0!important;height:auto!important;padding:2px 4px 6px;margin:0 4px!important;--cw:50px;--ch:70px;scrollbar-width:thin}
  .opp .obf:empty{display:none!important}
  .opp .obf .bfc{position:relative!important;left:auto!important;top:auto!important;flex:none}
  .opp .obf .bfc.tapped{margin:0 10px}
  .opp footer{padding:4px 8px!important;gap:6px;flex-wrap:wrap}
  .opp footer .zonebtn{padding:4px 8px!important;font-size:12px}
  .opp .czmini{--cw:34px!important;--ch:47px!important}
  .opp .czmini .card{width:34px!important;height:47px!important;font-size:6px!important}
  .opp .czmini .card *{font-size:6px!important}
  .opp footer{min-height:0!important}
  .opp header .meta{font-size:12px}
  #me{display:flex!important;flex-direction:column;padding:0 6px!important;height:auto!important}
  #stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:13px;order:2}
  #stats .piles{grid-column:1/-1;grid-template-columns:repeat(4,1fr)}
  #bfwrap{height:auto!important;min-height:120px;order:1}
  #bf{display:flex!important;flex-wrap:wrap;align-content:flex-start;gap:8px 6px;margin:6px 0!important;min-height:110px;--cw:62px;--ch:87px}
  #bf .bfc{position:relative!important;left:auto!important;top:auto!important;flex:none}
  #bf .bfc.tapped{margin:0 13px}
  #bf .mob-sep{flex-basis:100%;height:0;margin:0}
  #hand{position:sticky;bottom:0;z-index:40;background:rgba(8,14,12,.96);backdrop-filter:blur(6px);border-top:1px solid var(--line);--cw:70px;--ch:98px;padding:6px 8px calc(6px + env(safe-area-inset-bottom))!important;min-height:calc(var(--ch) + 14px)!important}
  #hand .card:hover{transform:none}
  #side{display:none!important}
  body.mob-log #side{display:flex!important;position:fixed;left:0;right:0;bottom:0;height:62vh;z-index:130;border-radius:16px 16px 0 0;border:1px solid rgba(212,168,79,.45);box-shadow:0 -20px 50px rgba(0,0,0,.6)}
  body.mob-log #insp{display:none}
  body.mob-log #logwrap{height:100%!important}
  #mobLogX{display:none}
  body.mob-log #mobLogX{display:block;position:fixed;right:12px;bottom:calc(62vh - 18px);z-index:131}
  #menu{position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:0!important;width:auto!important;max-width:none!important;max-height:72vh;overflow:auto;border-radius:16px 16px 0 0!important;padding:8px 8px calc(10px + env(safe-area-inset-bottom))!important;z-index:150;box-shadow:0 -20px 50px rgba(0,0,0,.65)!important}
  #menu button{min-height:44px;font-size:15px}
  #menu .mh{font-size:17px;padding:6px 8px}
  #menu .mob-colours{display:flex;gap:6px;flex-wrap:wrap;padding:4px 6px 8px}
  #menu .mob-colours button{flex:1 1 52px;min-height:46px;justify-content:center}
  #modal .box{max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 24px);overflow:auto}
  #u28askBtn{right:12px!important;bottom:calc(12px + env(safe-area-inset-bottom))!important;padding:9px!important;font-size:0!important;gap:0!important;width:48px;height:48px;justify-content:center}
  #u28askBtn img{width:28px!important;height:28px!important}
  #lobby{padding-left:8px!important;padding-right:8px!important}
  #lobby .panel{padding:16px 14px!important}
  /* lobby */
  .botseats{grid-template-columns:1fr 1fr!important}
  .botseats > .label{display:none}
  .botseats > .hint[data-seat]{grid-column:1/-1;margin-top:6px;font-weight:700}
  .botseats [data-botf="deck"], .botseats > :nth-child(4n):not(.label){grid-column:1/-1}
  .botseats [data-botf="deck"]{width:100%}
  #botN, .seg{flex-wrap:wrap}
  .d29hero{height:auto!important;min-height:0}
  .d29hero video{position:absolute}
  .d29hero::after{background:linear-gradient(180deg,rgba(8,14,12,.2),rgba(8,14,12,.92) 55%)!important}
  .d29info{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;padding:120px 14px 14px;grid-template-columns:auto minmax(0,1fr)!important;gap:12px!important}
  .d29cmdr{width:86px!important}
  .d29meta h3{font-size:20px!important}
  .d29tabs button{padding:9px 14px!important}
  .d29cols{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))!important;gap:12px!important}
  .d29grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr))!important;gap:10px!important}
  .d29res .add{opacity:1!important;transform:none!important;width:34px;height:34px}
  .d29card .ctl{opacity:1!important;transform:none!important}
  .td-box{width:100vw!important;height:100dvh!important;border-radius:0!important;padding:12px!important}
  .td-list{grid-template-columns:1fr!important}
  .td-d{flex-direction:column;align-items:stretch}
}`;
const MOB = {on:false};
function mobCheck(){ const on = window.innerWidth <= 760; if (on !== MOB.on){ MOB.on = on; document.body.classList.toggle('mob', on); try { if (typeof renderGame === 'function' && S && S.bf) renderGame(); } catch {} } }
(function(){ const st = document.createElement('style'); st.id = 'mobcss'; st.textContent = MOB_CSS; document.head.appendChild(st); mobCheck(); window.addEventListener('resize', () => { clearTimeout(MOB.rt); MOB.rt = setTimeout(mobCheck, 150); }); })();
// battlefield order on a phone: creatures, then other permanents, then lands
{ const rg = renderGame; renderGame = function(){ const r = rg.apply(this, arguments);
    try { document.body.classList.add('ptg');
      if (MOB.on){ const bf = document.getElementById('bf'); if (bf) for (const el of bf.querySelectorAll('.bfc[data-id]')){ const c = S.bf.find(x => x.id === +el.dataset.id); if (!c) continue; const t = (faceOf(c)?.t || info(c.k)?.t || '');
          el.style.order = /\bCreature\b/.test(t) ? 1 : /\bLand\b/.test(t) ? 4 : /\bPlaneswalker\b/.test(t) ? 2 : 3; } }
      const tb = document.getElementById('topbar'); if (tb && !tb.querySelector('#mobLogBtn')){ const b = document.createElement('button'); b.id = 'mobLogBtn'; b.type = 'button'; b.className = 'btn small ghost'; b.textContent = 'Log'; b.title = 'Table log and chat'; b.onclick = () => document.body.classList.toggle('mob-log'); tb.appendChild(b); }
      if (!document.getElementById('mobLogX')){ const x = document.createElement('button'); x.id = 'mobLogX'; x.type = 'button'; x.className = 'btn small'; x.textContent = 'Close'; x.onclick = () => document.body.classList.remove('mob-log'); document.body.appendChild(x); }
      const lb = document.getElementById('mobLogBtn'); if (lb) lb.style.display = MOB.on ? '' : 'none';
    } catch (e){ console.warn('mob render', e); }
    return r; }; }
// a card's mana colours as buttons right in its menu (one tap instead of "ability" → "colour")
{ const cm = cardMenu; cardMenu = function(id, x, y){
    const r = cm.apply(this, arguments);
    try { const m = document.getElementById('menu'); const [z,, c] = find(id); if (!m || m.hidden || z !== 'bf' || !c) return r;
      const abs = manaAbs(c) || [];
      m.querySelectorAll('button[data-act="manaAb"]').forEach(b => { const i = +b.dataset.i; const ab = abs[i]; if (!ab || !ab.outs || ab.outs.length < 2 || b.disabled) return;
        const cost = ab.tapOnly ? 'Tap for' : manaHTML(ab.cost) + ':';
        const row = document.createElement('div'); row.className = 'mob-colours';
        row.innerHTML = `<div class="mh" style="flex-basis:100%;padding:2px 2px 0;font-size:13px;color:var(--dim)">${cost} add one of</div>` + ab.outs.map((o, ci) => mb('manaGo', manaHTML(o.map(x => '{' + x + '}').join('')), `data-id="${c.id}" data-ab="${i}" data-ch="${ci}" title="Add ${o.join('')}"`)).join('');
        b.replaceWith(row); });
      // "~" in ability text is the card's own name
      m.querySelectorAll('button[data-act="actAb"] > span, button[data-act="manaAb"] > span').forEach(sp => { for (const n of sp.childNodes) if (n.nodeType === 3 && n.nodeValue.includes('~')) n.nodeValue = n.nodeValue.replace(/~/g, cname(c)); });
      if (!MOB.on){ const rr = m.getBoundingClientRect(); m.style.top = Math.max(8, Math.min(parseFloat(m.style.top) || 8, window.innerHeight - rr.height - 8)) + 'px'; }
    } catch (e){ console.warn('mob menu', e); }
    return r; }; }
// the quick action on a permanent without a mana ability but with one "{T}: …" ability (fetch lands, Mind Stone-style
// activations, utility lands): use that ability, instead of just turning the card sideways
{ const qt = quickTap; quickTap = function(id){
    try { const [z,, c] = find(id); if (z === 'bf' && c && !c.fd && !c.tap && !(c.n > 1) && !isPW(c) && !(tapOptions(c) || []).length){
        const abs = (abilityList(c) || []).filter(ab => /\{T\}/.test(ab.cost || ''));
        if (abs.length === 1){ activateAbility(c, abs[0]); return; }
        if (abs.length > 1){ const el = document.querySelector(`.card[data-id="${id}"]`); const r = el ? el.getBoundingClientRect() : {right:200, top:200}; cardMenu(id, r.right, r.top); return; } } } catch (e){ console.warn('mob quick', e); }
    return qt.apply(this, arguments); }; }
// A menu that opens under your finger must not take that same tap ("ghost click" on phones: the tap that opened a card's
// menu landed on the button now under the finger — e.g. spent Lotus Petal on white without you choosing).
// (touch only: a mouse click never lands twice)
document.addEventListener('pointerdown', e => { MOB.ptr = e.pointerType; }, true);
{ const om = openMenuAt; openMenuAt = function(){ MOB.menuT = MOB.ptr === 'touch' ? Date.now() : 0; return om.apply(this, arguments); }; }
document.addEventListener('click', e => { if (MOB.menuT && e.target.closest && e.target.closest('#menu') && Date.now() - MOB.menuT < 450){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);
