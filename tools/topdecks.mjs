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
const txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&rarr;/g, '→').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
  let meta = null; for (const m of strip(page).matchAll(/href=["']?\??[^"' >]*meta=(\d+)[^"' >]*["']?[^>]*>\s*(?:<[^>]+>\s*)*([^<]+)/g)){ if (/last 6 months/i.test(m[2])){ meta = m[1]; break; } }
  console.log(F, 'meta id for last 6 months:', meta);
  // 1) every event of the last 6 months (the event list is paged: cp=1, 2, …)
  const events = [];
  for (let cp = 1; cp <= +(process.env.MAXPAGES || 40); cp++){
    const t = await get(`https://www.mtgtop8.com/format?f=${F}${meta ? '&meta=' + meta : ''}&cp=${cp}`, {latin:true}); if (!t) break;
    const ids = [...new Set([...strip(t).matchAll(/event\?e=(\d+)&(?:amp;)?f=/g)].map(m => m[1]))].filter(id => !events.includes(id));
    if (!ids.length) break; events.push(...ids);
  }
  console.log(F, 'events:', events.length);
  // 2) every deck in those events: deck name (= the commander or a short name for the pair), place, player, date
  const decks = [];
  for (const e of events){
    const t = await get(`https://www.mtgtop8.com/event?e=${e}&f=${F}`, {latin:true}); if (!t) continue; const s = strip(t);
    const title = txt((s.match(/<div[^>]*class=["']?event_title["']?[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const meta2 = txt(s.slice(s.indexOf('players'), s.indexOf('players') + 1) ? (s.match(/(\d+) players - (\d\d\/\d\d\/\d\d)/) || [''])[0] : '');
    const pm = s.match(/(\d+) players - (\d\d)\/(\d\d)\/(\d\d)/); const date = pm ? `20${pm[4]}-${pm[3]}-${pm[2]}` : ''; const players = pm ? +pm[1] : null;
    const seen = new Set();
    for (const m of s.matchAll(/href=["']?\?e=\d+&(?:amp;)?d=(\d+)&(?:amp;)?f=[^"' >]*["']?[^>]*>([^<]+)<\/a>/g)){
      const name = txt(m[2]); if (!name || /→/.test(name) || seen.has(m[1])) continue; seen.add(m[1]);
      const before = txt(s.slice(Math.max(0, m.index - 400), m.index).replace(/<[^>]*$/, '')); const place = (before.match(/(\d+(?:-\d+)?)\s*$/) || [])[1] || '';
      const after = s.slice(m.index, m.index + 600); const player = txt((after.match(/player=[^>]*>([^<]+)</) || [])[1] || '');
      decks.push({name, d:m[1], e, place, player, date, players, event:title});
    }
  }
  console.log(F, 'decks:', decks.length, decks.slice(0, 3));
  // 3) rank deck names by how many top-8 decks they have; fetch the newest lists for the top ones
  const by = new Map(); for (const d of decks){ const k = d.name.toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
  const ranked = [...by.values()].sort((a, b) => b.length - a.length).slice(0, Math.ceil(LIMIT * 1.5));   // extra: some names merge below
  for (const list of ranked){
    list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (parseInt(a.place) || 9) - (parseInt(b.place) || 9));
    const out = [];
    for (const d of list){
      if (out.length >= PER) break;
      const t = await get(`https://www.mtgtop8.com/mtgo?d=${d.d}`, {latin:true}); if (!t) continue;
      const L = parseList(t); const n = L.main.reduce((x, y) => x + y[0], 0) + L.side.reduce((x, y) => x + y[0], 0);
      if (n < 90 || !L.side.length){ console.log('  skipped', d.name, d.d, n, 'cards', L.side.length, 'in sideboard'); continue; }
      out.push({id:d.d, url:`https://www.mtgtop8.com/event?e=${d.e}&d=${d.d}&f=${F}`, place:d.place, player:d.player, date:d.date, players:d.players, event:d.event, cmd:L.side.map(x => x[1]), main:L.main});
    }
    if (!out.length) continue;
    res.commanders.push({name:out[0].cmd.join(' + '), alias:list[0].name, count:list.length, decks:out});
    console.log(`  ${F} #${res.commanders.length} ${out[0].cmd.join(' + ')} (${list[0].name}): ${list.length} top-8 decks, kept ${out.length}`);
  }
  // the same commander(s) can show up under two deck names: merge them
  const merged = new Map();
  for (const c of res.commanders){ const k = c.name.toLowerCase(); const m = merged.get(k); if (!m){ merged.set(k, c); continue; } m.count += c.count; m.decks = [...m.decks, ...c.decks].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, PER); }
  res.commanders = [...merged.values()].sort((a, b) => b.count - a.count).slice(0, LIMIT);
  res.events = events.length; res.decks = decks.length;
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
// card art for every commander (Scryfall, 75 names per request)
async function addArt(data){
  const names = [...new Set([data.cedh, data.duel, data.edhrec].flatMap(g => g.commanders.flatMap(c => c.cmd || (c.decks || [])[0]?.cmd || [])))];
  const art = {};
  for (let i = 0; i < names.length; i += 75){
    try { const r = await fetch('https://api.scryfall.com/cards/collection', {method:'POST', headers:{...UA, 'content-type':'application/json', accept:'application/json'}, body:JSON.stringify({identifiers:names.slice(i, i + 75).map(name => ({name:name.split(' // ')[0]}))})});
      const j = await r.json(); for (const c of j.data || []){ const f = c.image_uris || (c.card_faces || [])[0]?.image_uris || {}; art[c.name] = {crop:f.art_crop || '', card:f.normal || '', ci:(c.color_identity || []).join('')}; if (c.name.includes(' // ')) art[c.name.split(' // ')[0]] = art[c.name]; }
      for (const n of j.not_found || []) console.log('  no art for', n.name);
    } catch (e){ console.log('  art lookup failed', e.message); }
    await sleep(200);
  }
  data.art = art; console.log('art for', Object.keys(art).length, 'of', names.length, 'commanders');
}
const t0 = Date.now();
const data = {built:new Date().toISOString(), cedh:await mtgtop8('cEDH'), duel:await mtgtop8('EDH'), edhrec:await edhrec()};
await addArt(data);
fs.mkdirSync('out', {recursive:true}); fs.writeFileSync('out/topdecks.json', JSON.stringify(data));
console.log('done in', ((Date.now() - t0) / 60000).toFixed(1), 'min;', 'cEDH', data.cedh.commanders.length, 'duel', data.duel.commanders.length, 'edhrec', data.edhrec.commanders.length, 'size', JSON.stringify(data).length);
