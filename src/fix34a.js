/* ===================== v34: paid transforms, tokens of any card ===================== */

/* ---------- a double-faced permanent whose face says "{cost}: Transform …" is transformed by paying that cost,
   not by the free "Transform" button (that button stays for cards that transform by a trigger or a condition) ---------- */
const f34PaidFlip = c => { try { if (!c || c.fd) return null; const a = info(c.k); if (!a || !a.back) return null; const f = c.fl ? a.back : a;
  return tname(f.o || '', f.n || '').split('\n').map(l => l.trim()).find(l => /^[^:"]*\{[^}]+\}[^:"]*:\s*transform\b/i.test(l)) || null; } catch { return null; } };
{
  const fl = ACT.flip;
  ACT.flip = function(el){ const [,, c] = find(+el.dataset.id); const line = f34PaidFlip(c);
    if (line && !(UI.f34force)){ toast(`${cname(c)} transforms by paying its cost — use “${short(line, 60)}” in its menu`); return; }
    return fl.call(this, el); };
  const cm = cardMenu;
  cardMenu = function(id, x, y){ const r = cm.apply(this, arguments);
    try { const [z,, c] = find(id); if (z === 'bf' && f34PaidFlip(c)) document.querySelectorAll('#menu [data-act="flip"]').forEach(b => b.remove()); } catch {}
    return r; };
}

/* ---------- Make a token: any card on Scryfall (lands, artifacts, anything) as a token copy ---------- */
async function f34CardToken(name){
  let c = null;
  try { const r = await sf('/cards/named?fuzzy=' + encodeURIComponent(name)); if (r && r.object === 'card') c = r; } catch {}
  if (!c) return null;
  const a = infoFrom(c); const k = a.k + '|tok';
  if (!DICT.has(k)) DICT.set(k, {...a, k, tok:true, cc:false, toks:a.toks || []});
  return k;
}
document.addEventListener('submit', e => {
  const f = e.target; if (!f || !f.dataset || f.dataset.form !== 'f34card') return;
  e.preventDefault(); const name = ($('#f34name')?.value || '').trim(); if (!name) return; const n = readQty();
  UI.modal.msg = 'Looking up ' + name + '…'; renderModal();
  (async () => { const k = await f34CardToken(name);
    if (!k){ UI.modal.msg = `No card called “${name}” on Scryfall`; renderModal(); return; }
    closeModal(); createToken(k, n); })();
}, true);
