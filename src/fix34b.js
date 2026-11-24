/* ===================== v34.1: choose how to pay Phyrexian mana (and K'rrik's {B}) =====================
   UI.phyLife = how many of the payable symbols are paid with 2 life each; the rest are paid with mana
   (as coloured mana, so untapped lands are tapped for them). null = the old automatic way. */
function f34bPhyCount(cost){ if (!cost) return {phy:0, b:0}; return {phy:(cost.phy || []).length, b:(S && rulesOn('phyB').length && cost.col) ? (cost.col.B || 0) : 0}; }
{
  const pp = payPlan;
  payPlan = function(cost, pool){
    const k0 = UI.phyLife; if (k0 == null || !cost || !cost.col) return pp(cost, pool);
    let k = k0; const phy = (cost.phy || []).slice(); const col = {...cost.col};
    const lifePhy = phy.splice(0, Math.min(k, phy.length)); k -= lifePhy.length;
    if (k > 0 && rulesOn('phyB').length){ const u = Math.min(k, col.B || 0); col.B -= u; k -= u; }
    phy.forEach(x => { col[x] = (col[x] || 0) + 1; });   // the ones paid with mana must be paid with that colour
    const c2 = {...cost, phy:[], col};
    const r = pp(c2, pool); if (r.err) return r;
    r.life = (r.life || 0) + 2 * (k0 - k);
    if (S && S.life < r.life) return {err:`needs ${r.life} life`};
    return r;
  };
}
async function f34bAsk(cost, name){
  try {
    if (!S || UI.dry || (typeof BOT !== 'undefined' && BOT.on) || UI.replay) return null;
    const {phy, b} = f34bPhyCount(cost); const n = phy + b; if (!n) return null;
    const opts = [];
    for (let k = 0; k <= n; k++){ UI.phyLife = k; let r; try { r = payPlan(cost, S.pool); } finally { UI.phyLife = null; } if (r && !r.err) opts.push({k, life:r.life || 0}); }
    if (opts.length <= 1) return opts.length ? opts[0].k : null;
    const sym = [phy ? `${phy} Phyrexian` : '', b ? `${b} {B} (K'rrik)` : ''].filter(Boolean).join(' + ');
    const v = await askChoice({title:`${name}: how do you pay the ${sym} symbol${n === 1 ? '' : 's'}?`, options:opts.map(o => ({value:o.k,
      label:o.k === 0 ? 'All with mana' : o.k === n ? `All with life — ${o.life} life` : `${o.k} with life (${o.life} life), ${n - o.k} with mana`}))});
    return v == null ? false : v;
  } catch (e){ console.warn('f34b', e); return null; }
}
