/* ---------------------------------------------------------------- fix23a: a board update that fails to read is recorded, not lost silently */
{
  const ss = sanitizeState;
  sanitizeState = function(s){
    let r = null, err = '';
    try { r = ss(s); } catch (e){ err = String(e && e.stack || e).slice(0, 400); }
    if (!r){
      if (!err){ const w = console.warn; let cap = ''; console.warn = (...a) => { cap = a.map(x => String(x && x.stack || x)).join(' ').slice(0, 400); }; try { ss(s); } catch (e){ cap = String(e && e.stack || e).slice(0, 400); } finally { console.warn = w; } err = cap || 'null'; }
      NET.sanBad = NET.sanBad || []; NET.sanBad.push({at:Date.now(), nm:s && s.nm, err}); if (NET.sanBad.length > 20) NET.sanBad.shift();
      console.warn('f23 board update rejected', s && s.nm, err);
    }
    return r;
  };
}
{ const rt = resolveTop; resolveTop = function(it){ if (!UI.resolving && it && S.stk.includes(it)) UI.f23it = {sid:it.sid, nm:it.nm, txt:String(it.txt || '').slice(0, 80), at:Date.now()}; return rt.apply(this, arguments); }; }
/* token lookups are cached per query (a miss too), so a turn that makes 200 tokens doesn't make 200 Scryfall searches */
{ const st = searchToken; const memo = new Map();
  searchToken = async function(q){ if (memo.has(q)){ const k = memo.get(q); if (!k || DICT.has(k)) return k; }
    let k = null; try { k = await st(q); } catch (e){ throw e; } memo.set(q, k || null); if (memo.size > 400) memo.delete(memo.keys().next().value); return k; }; }
