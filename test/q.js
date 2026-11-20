// quick: node q.js "Name1" "Name2" ... → prints checker issues for those cards (real text from all.json)
const H = require('./h'); const all = require('./cards').topCards('all.json');
const names = process.argv.slice(2);
(async () => { const b = await H.chromium.launch(); const p = await (await b.newContext()).newPage(); p.on('pageerror', e => console.log('pageerror', e.message)); await H.route(p); await p.goto(H.FILE);
  const list = names.length ? all.filter(c => names.includes(c.name)) : [];
  const out = await p.evaluate(async list => { LOBBY.deck = {main:[], cmd:[], name:'q'}; const o = []; for (const c of list){ const a = addInfo(infoFrom(c)); const r = await checkCard(a.k); o.push(r.name + (r.issues.length ? '\n   ' + r.issues.map(x => x.kind + ': ' + x.text).join('\n   ') : '  ✓')); } return o; }, list);
  console.log(out.join('\n')); await b.close(); process.exit(0); })();
