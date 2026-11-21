// Checks every card name in topdecks.json against Scryfall, so every listed deck loads completely.
import fs from 'fs';
const src = process.argv[2] || 'https://georgesmarieyazigi-code.github.io/Proxy-table/topdecks.json';
const d = src.startsWith('http') ? await (await fetch(src)).json() : JSON.parse(fs.readFileSync(src, 'utf8'));
const names = new Map();
const add = (n, where) => { if (!names.has(n)) names.set(n, where); };
for (const g of ['cedh', 'duel']) for (const c of d[g].commanders) for (const x of c.decks){ x.cmd.forEach(n => add(n, c.name)); x.main.forEach(([, n]) => add(n, c.name)); }
for (const c of d.edhrec.commanders){ c.cmd.forEach(n => add(n, c.name)); c.main.forEach(([, n]) => add(n, c.name)); }
console.log('unique names', names.size);
const list = [...names.keys()]; const bad = [];
for (let i = 0; i < list.length; i += 75){
  const r = await fetch('https://api.scryfall.com/cards/collection', {method:'POST', headers:{'content-type':'application/json', 'user-agent':'ProxyTable/1.0', accept:'application/json'}, body:JSON.stringify({identifiers:list.slice(i, i + 75).map(name => ({name}))})});
  const j = await r.json(); for (const n of j.not_found || []) bad.push(n.name);
  await new Promise(r => setTimeout(r, 150));
}
console.log('not found on Scryfall by exact name:', bad.length);
for (const n of bad) console.log('  ', JSON.stringify(n), '— in', names.get(n));
