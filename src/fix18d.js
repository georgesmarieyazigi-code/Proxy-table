/* ===== fix18d: no free face-down cards, no free untapping (Georges, 6 Nov) =====
   1. A card can only be turned face down / face up by a card's rule (morph, disguise, manifest, cloak, foretell…):
      the manual "Turn face down / face up" and "Play face down" need Strict rules off or "Fix something by hand".
   2. Untapping by hand is only an undo of a mana tap whose mana is still unspent in the pool: the mana goes away
      with it. A land whose mana was spent, a creature that attacked (or was tapped for any other cost/effect)
      can't be untapped by hand — only by the untap step or a card (vigilance creatures never tap to attack).
   Everything is still possible in "Fix something by hand" (logged for the table) or with Strict rules off. */

// --- remember what each mana tap produced ---
function d18PoolCopy(){ return Object.assign(emptyPool(), S.pool || {}); }
{
  const am = activateMana;
  activateMana = async function(c, ab, ch, ...rest){
    const before = d18PoolCopy(); const wasTap = !!(c && c.tap);
    const r = await am.call(this, c, ab, ch, ...rest);
    try {
      if (c && c.tap && !wasTap && (c.n || 1) === 1){
        const diff = {}; let any = false;
        for (const k of Object.keys(emptyPool())){ const d = (S.pool[k] || 0) - (before[k] || 0); if (d > 0){ diff[k] = d; any = true; } }
        if (any) c.d18mana = diff; else delete c.d18mana;
      }
    } catch (e){ console.warn('d18 mana', e); }
    return r;
  };
}
const d18Str = m => Object.entries(m || {}).map(([k, n]) => `{${k}}`.repeat(n)).join('');
// can this tapped permanent's mana still be taken back from the pool?
function d18Undoable(c){
  const m = c && c.tap && c.d18mana; if (!m) return false;
  return Object.entries(m).every(([k, n]) => (S.pool[k] || 0) >= n);
}

// --- the tap/untap button ---
{
  const tt = tapToggle;
  tapToggle = function(id, ...rest){
    const [z,,c] = find(id); if (z !== 'bf' || !c) return tt.call(this, id, ...rest);
    const stack = (c.n || 1) > 1;
    const untapping = stack ? (c.tn || 0) >= c.n : !!c.tap;
    if (!untapping){ delete c.d18mana; return tt.call(this, id, ...rest); }   // tapping by hand is still allowed
    if (looseOk()){ if (fixing()) log(`⚠ fixed by hand: untapped ${cname(c)}`); delete c.d18mana; return tt.call(this, id, ...rest); }
    if (!stack && d18Undoable(c)){
      for (const [k, n] of Object.entries(c.d18mana)) S.pool[k] -= n;
      const m = d18Str(c.d18mana); delete c.d18mana;
      c.tap = false; log(`untapped ${cname(c)} — took back ${m} it made (the mana was unspent)`); commit(); return;
    }
    const why = c.atk ? `${cname(c)} attacked, so it stays tapped`
      : c.d18mana ? `the mana from ${cname(c)} was already spent, so it stays tapped`
      : `${stack ? 'these' : cname(c)} can only be untapped by the untap step or a card`;
    toast(`${cap(why)}. If the game got something wrong: Game ▾ → Fix something by hand.`);
  };
}
// the stack buttons "Untap one"
{
  const f = ACT.stack;
  if (f) ACT.stack = function(el, e){
    if (el && el.dataset.op === 'untap1' && !looseOk()){ closeMenu(); toast(`Untapping by hand isn't allowed — only the untap step or a card can untap. If the game got something wrong: Game ▾ → Fix something by hand.`); return; }
    if (el && el.dataset.op === 'untap1' && fixing()) log('⚠ fixed by hand: untapped one token');
    return f.call(this, el, e);
  };
}
// a fresh untap (untap step, effects) or leaving the battlefield forgets the mana record
{
  const ol = onLeave;
  onLeave = function(c, ...a){ try { if (c) delete c.d18mana; } catch {} return ol.call(this, c, ...a); };
}

// --- face down / face up by hand ---
{
  const f = ACT.fd;
  ACT.fd = function(el, e){
    const [,,c] = find(+el.dataset.id);
    if (c && !manualOk(c.fd ? `turning ${cname(c)} face up` : 'turning a card face down')){ closeMenu(); return; }
    return f.call(this, el, e);
  };
}

// --- menu labels: say what the button will do (the card menu goes through openMenuAt) ---
{
  const om = openMenuAt;
  openMenuAt = function(html, ...a){
    try {
      if (typeof html === 'string' && !looseOk()){
        const id = +(html.match(/data-act="tap" data-id="(\d+)"/) || [])[1];
        const c = id && find(id)[2];
        if (c && c.tap && (c.n || 1) === 1)
          html = html.replace(/(data-act="tap" data-id="\d+">)Untap/, d18Undoable(c) ? `$1Untap — undo, takes back ${d18Str(c.d18mana)}` : `$1Untap (only a card or the untap step)`);
        html = html.replace(/<button type="button" data-act="fd"[^>]*>[^<]*(?:<kbd>[^<]*<\/kbd>)?<\/button>/g, '');
      }
    } catch (e){ console.warn('d18 menu', e); }
    return om.call(this, html, ...a);
  };
}
