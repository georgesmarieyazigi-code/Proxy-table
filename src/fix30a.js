/* ===== fix30a: "~ deals damage equal to the number of <things> you control to <target>" (Caesar, Legion's Emperor and the like) ===== */
async function f30DmgCount(s, l, ctx){
  const m = l.match(/^(?:~|he|she|it|they) deals? damage equal to the number of (.+?) you control to (target opponent|target player|any target|each opponent|target creature or planeswalker|target creature)$/);
  if (!m) return false;
  if (UI.dry) return true;
  const what = m[1]; const tokOnly = /\btokens?\b/.test(what);
  const desc = what.replace(/\s*\btokens?\b/, '').trim();
  const one = (typeof sing === 'function' ? sing(desc) : desc.replace(/s$/, ''));
  const n = S.bf.reduce((a, c) => a + (!c.fd && (!tokOnly || c.tok) && (one === 'permanent' || descOk(c.k, one, {tok:c.tok})) ? (c.n || 1) : 0), 0);
  const srcC = S.bf.find(c => c.id === ctx.srcId) || null;
  const nm = ctx.name || 'It';
  if (!n){ log(`${nm}: you control no ${what}, so no damage`); commit(); return true; }
  if (m[2] === 'each opponent'){ for (const p of opponents()) dealDamage({t:'player', pid:p.pid}, n, ctx.k, srcC); log(`${nm} deals ${n} damage to each opponent (${n} ${what})`); commit(); return true; }
  let t = ctx.tgts ? (nextTargets(ctx) || [])[0] : null;
  if (!t && /opponent|player/.test(m[2])){ const o = opponents(); if (o.length === 1) t = {t:'player', pid:o[0].pid}; }
  if (!t){ log(`${nm}: no target for ${n} damage`); commit(); return true; }
  dealDamage(t, n, ctx.k, srcC); log(`${nm} deals ${n} damage to ${t.t === 'player' ? nameOf(t.pid) : (t.k ? info(t.k)?.n : 'the target')} (${n} ${what})`); commit(); return true;
}
{ const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await f30DmgCount(s, l, ctx || {})) return; return ds(s0, ctx); }; }
