/* ===================== Rules engine — round 20: player counters always automatic ===================== */
async function doRound20Pre(s, l, ctx){
  let m;
  // “they get that many poison counters”, “that player gets two poison counters”, “each opponent gets a rad counter”, “target player gets X poison counters”
  if ((m = l.match(/^(they|that player|target player|target opponent|each opponent|each player|you|defending player) (?:each )?gets? (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many) (poison|rad|energy|experience|ticket) counters?$/))){
    const kind = m[3]; let n = m[2] === 'that many' ? (ctx.it && ctx.it.evN) || 0 : m[2] === 'x' ? (ctx.it && ctx.it.x) || 0 : (wn(m[2]) || 1);
    let pids = [];
    if (m[1] === 'you') pids = [MYPID];
    else if (m[1] === 'they' || m[1] === 'that player' || m[1] === 'defending player') pids = [ctx.it && (ctx.it.evDp || ctx.it.evPid)].filter(Boolean);
    else if (/^target/.test(m[1])){ const t = (ctx.tgts ? nextTargets(ctx) : [])[0]; pids = t ? [t.pid] : []; }
    else if (m[1] === 'each opponent') pids = opponents().map(p => p.pid);
    else pids = players().map(p => p.pid);
    if (!n){ log(`${ctx.name}: 0 ${kind} counters`); return true; }
    for (const pid of pids){
      if (pid === MYPID){ if (kind === 'poison'){ S.psn += n; log(`gets ${n} poison → ${S.psn}`); } else addPC(kind, n); }
      else sendRq(pid, kind === 'poison' ? 'psn' : kind === 'rad' ? 'rad' : 'pctr', n, ctx.name, {d:kind});
    }
    if (pids.length) log(`${ctx.name}: ${pids.map(nameOf).join(', ')} get${pids.length === 1 ? 's' : ''} ${n} ${kind} counter${n === 1 ? '' : 's'}`);
    commit(); return true;
  }
  return false;
}
{
  const ds = doSentence;
  doSentence = async function(s0, ctx){ const s = String(s0).replace(/\.$/, '').trim(); const l = s.toLowerCase(); if (l && await doRound20Pre(s, l, ctx)) return; return ds(s0, ctx); };
  RQ_OPS.push('pctr');
  const ao = applyOp;
  applyOp = function(r, from){ if (r.op === 'pctr'){ addPC(String(r.d || 'energy'), r.n); return; } return ao(r, from); };
}
