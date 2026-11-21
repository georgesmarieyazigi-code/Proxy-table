// Builds topdecks.json: the most-played commanders with real decklists.
//   - Tournament: MTGTop8 metagame (last 6 months) for cEDH and Duel Commander — up to 3 top-8 decks per commander
//   - Most played: EDHREC's top commanders of the past year, with EDHREC's average deck
// Run on GitHub (needs internet): node tools/topdecks.mjs  → out/topdecks.json
import fs from 'fs';
const UA = {'user-agent':'Mozilla/5.0 (ProxyTable deck picker; github.com/georgesmarieyazigi-code/proxy-table)'};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIMIT = +(process.env.LIMIT || 100), PER = +(process.env.PER || 3);
async function get(u, {latin = false, tries = 3} = {}){
  for (let i = 0; i < tries; i++){
    try { const r = await fetch(u, {headers:UA}); if (r.status === 200){ const b = Buffer.from(await r.arrayBuffer()); await sleep(350); return new TextDecoder(latin ? 'windows-1252' : 'utf-8').decode(b); } console.log('  HTTP', r.status, u); }
    catch (e){ console.log('  fetch error', u, e.message); }
    await sleep(1500 * (i + 1));
  }
  return null;
}
const strip = s => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const fixName = n => n.replace(/\s+/g, ' ').trim();

function parseList(t){
  // MTGO export: main deck, a blank line, then the sideboard (MTGTop8 puts the commander(s) there for Commander formats)
  const lines = t.replace(/\r/g, '').split('\n'); const main = [], side = []; let sb = false;
  for (const l0 of lines){ const l = l0.trim(); if (!l){ if (main.length) sb = true; continue; } if (/^sideboard/i.test(l)){ sb = true; continue; }
    const m = l.match(/^(\d+)\s+(.+)$/); if (!m) continue; (sb ? side : main).push([+m[1], fixName(m[2])]); }
  return {main, side};
}
async function mtgtop8(F){
  const res = {format:F, commanders:[]};
  const page = await get(`https://www.mtgtop8.com/format?f=${F}`); if (!page){ console.log('no format page', F); return res; }
  const p = strip(page);
  // find the "Last 6 Months" metagame link
  let meta = null; for (const m of p.matchAll(/href=["']?\??[^"' >]*meta=(\d+)[^"' >]*["']?[^>]*>\s*(?:<[^>]+>\s*)*([^<]+)/g)){ if (/last 6 months/i.test(m[2])){ meta = m[1]; break; } }
  console.log(F, 'meta id for last 6 months:', meta);
  const mp = meta ? strip(await get(`https://www.mtgtop8.com/format?f=${F}&meta=${meta}`) || '') : p;
  // archetype rows: link to archetype?a=… with the commander name, followed by a percentage
  const arch = []; const seen = new Set();
  for (const m of mp.matchAll(/href=["']?(archetype\?a=(\d+)[^"' >]*)["']?[^>]*>([\s\S]{0,300}?)<\/a>/g)){
    const name = txt(m[3]); if (!name || seen.has(m[2]) || /^other/i.test(name)) continue; seen.add(m[2]);
    const after = txt(mp.slice(m.index + m[0].length, m.index + m[0].length + 300)); const pct = (after.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
    arch.push({id:m[2], href:m[1].replace(/&amp;/g, '&'), name, pct:pct ? +pct : null});
  }
  console.log(F, 'archetypes found:', arch.length, arch.slice(0, 8).map(a => `${a.name} ${a.pct}%`).join(' | '));
  if (!arch.length) console.log(mp.slice(0, 3000));
  for (const a of arch.slice(0, LIMIT)){
    const ap = await get('https://www.mtgtop8.com/' + a.href); if (!ap) continue; const s = strip(ap);
    const decks = []; const ds = new Set();
    for (const m of s.matchAll(/href=["']?([^"' >]*[?&]e=(\d+)&(?:amp;)?d=(\d+)[^"' >]*)["']?[^>]*>([^<]*)</g)){
      if (ds.has(m[3])) continue; ds.add(m[3]);
      // the table row around the link holds deck name, player, event, rank and date
      const rs = s.lastIndexOf('<tr', m.index), re = s.indexOf('</tr>', m.index); const row = rs >= 0 && re > 0 ? s.slice(rs, re) : '';
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c => txt(c[1])).filter(Boolean);
      decks.push({e:m[2], d:m[3], cells});
      if (decks.length >= PER) break;
    }
    if (!decks.length){ console.log('  no decks on', a.name); continue; }
    const out = [];
    for (const d of decks){
      const t = await get(`https://www.mtgtop8.com/mtgo?d=${d.d}`, {latin:true}); if (!t) continue;
      const L = parseList(t); const n = L.main.reduce((x, y) => x + y[0], 0) + L.side.reduce((x, y) => x + y[0], 0);
      if (n < 90){ console.log('  short list', a.name, d.d, n); continue; }
      out.push({id:d.d, url:`https://www.mtgtop8.com/event?e=${d.e}&d=${d.d}&f=${F}`, info:d.cells.slice(0, 6), cmd:L.side.map(x => x[1]), main:L.main});
    }
    if (out.length) res.commanders.push({name:a.name, pct:a.pct, decks:out});
    console.log(`  ${F} ${a.name}: ${out.length} decks; commander(s) ${out[0] ? out[0].cmd.join(' + ') : '-'}; info ${out[0] ? JSON.stringify(out[0].info) : ''}`);
  }
  return res;
}
async function edhrec(){
  const res = {commanders:[]};
  const y = await get('https://json.edhrec.com/pages/commanders/year.json'); if (!y) return res;
  const j = JSON.parse(y); const list = (j.container?.json_dict?.cardlists || []).flatMap(c => c.cardviews || []).slice(0, LIMIT);
  console.log('EDHREC top', list.length);
  for (const c of list){
    const a = await get(`https://json.edhrec.com/pages/average-decks/${c.sanitized}.json`); if (!a) continue;
    try { const d = JSON.parse(a).deck; const main = Object.values(d.cards || {}).flat().map(([n, q]) => [q, fixName(n)]);
      res.commanders.push({name:c.name, decks:+c.num_decks || null, rank:c.rank, cmd:(d.commander || [c.name]).map(fixName), main, url:`https://edhrec.com/average-decks/${c.sanitized}`});
    } catch (e){ console.log('  bad average deck', c.name, e.message); }
  }
  console.log('EDHREC average decks:', res.commanders.length);
  return res;
}
const t0 = Date.now();
const data = {built:new Date().toISOString(), cedh:await mtgtop8('cEDH'), duel:await mtgtop8('EDH'), edhrec:await edhrec()};
fs.mkdirSync('out', {recursive:true}); fs.writeFileSync('out/topdecks.json', JSON.stringify(data));
console.log('done in', ((Date.now() - t0) / 60000).toFixed(1), 'min;', 'cEDH', data.cedh.commanders.length, 'duel', data.duel.commanders.length, 'edhrec', data.edhrec.commanders.length, 'size', JSON.stringify(data).length);
