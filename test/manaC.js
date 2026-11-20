// Mana audit (round 21C): every mana ability of the 7,000 cards in all.json (+extra.json), put on a test battlefield,
// tapped for real, and the pool compared with what the Oracle text says.
//   PTFILE=devC.html node manaC.js            → summary + /tmp/Cmana.json (per-ability verdicts)
//   PTFILE=devC.html node manaC.js "Sol Ring" "Gaea's Cradle"   → verbose for those cards
// Fixture (fixed, so the expected numbers are known): commander Atraxa (W U B G identity); battlefield: Forest ×2, Swamp,
// Island, Mountain, Plains, Llanowar Elves, Elvish Mystic, Atraxa (legendary 4/4) + the card under test (charge/other counters 2,
// chosen colour G, imprint Lightning Bolt); hand: Lightning Bolt, Llanowar Elves, Forest; graveyard 7 cards; life 40;
// pool before each activation {W}{W}{U}{U}{B}{B}{R}{R}{G}{G}{C}{C}; one opponent controlling a Mountain.
const H = require('./h'); const fs = require('fs');
const CC = require('./cards');
const all = CC.topCards('all.json').concat(CC.topCards('extra.json'));
const names = process.argv.slice(2);
const basics = CC.cards.filter(c => /^(Forest|Island|Swamp|Mountain|Plains)$/.test(c.name));
(async () => {
  const b = await H.chromium.launch(); const p = await (await b.newContext()).newPage();
  p.on('pageerror', e => console.log('pageerror', e.message));
  await H.route(p); await p.goto(H.FILE);
  await p.evaluate(list => { LOBBY.deck = {main:[], cmd:[], name:'mana audit'}; for (const c of list){ try { addInfo(infoFrom(c)); } catch {} } }, basics.concat(all.filter((c, i, a) => a.findIndex(x => x.name === c.name) === i)));
  const R = await p.evaluate(async ([only]) => {
    const KEY = new Map(); for (const a of DICT.values()) if (!KEY.has(a.n)) KEY.set(a.n, a.k);
    const K = n => KEY.get(n);
    const COL = ['W', 'U', 'B', 'R', 'G'];
    const NUM = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
    // ---------- test board ----------
    let REC = null;
    const saved = {commit, log, toast, publish, queueSave, openModal, handWarn, renderStackPanel, sendRq};
    commit = () => {}; log = (s) => { if (REC) REC.log.push(String(s)); }; publish = () => {}; queueSave = () => {}; renderStackPanel = () => {};
    toast = (s) => { if (REC) REC.toast.push(String(s)); };
    handWarn = (s) => { if (REC) REC.hand.push(String(s)); };
    sendRq = () => {};
    openModal = m => { if (REC) REC.modals.push({type:m.type, title:String(m.title || '')});
      if (m.type === 'choice' && m.resolve){ const o = (m.options || []).filter(x => !x.disabled); return m.resolve(o.length ? o[/how many/i.test(m.title || '') ? 0 : o.length - 1].value : null); }
      if (m.type === 'pick' && m.resolve) return m.resolve((m.cards || []).slice(0, Math.max(m.min || 0, m.max ? 1 : 0)).map(c => c.id));
      if (m.type === 'ask' && m.resolve) return m.resolve(m.def ?? 1);
      if (m.resolve) return m.resolve(m.type === 'target' ? [] : (m.type === 'yes' || m.type === 'confirm') ? true : null);
      if (m.run) return m.run(m.def ?? 1);
      if (m.onClose) return m.onClose();
    };
    const oppPid = 'zz-opp';
    function board(k){
      S = newState(); S.deck.cmd = [K("Atraxa, Praetors' Voice")]; S.turn = [3, MYPID, 0]; S.ph = [0, 3, 3]; S.life = 40;
      OPP.clear(); OPP.set(oppPid, {nm:'Opp', j:Date.now() + 5, bf:[{id:7001, k:K('Mountain')}], gy:[], ex:[], hand:2, life:40, turn:[0, '', 0]});
      const add = (n, o = {}) => { const c = {id:S.nid++, k:typeof n === 'string' && KEY.has(n) ? K(n) : n, tap:false, sk:false, cp:0, cm:0, co:0, n:1, tn:0, ...o}; S.bf.push(c); return c; };
      ['Forest', 'Forest', 'Swamp', 'Island', 'Mountain', 'Plains'].forEach(n => add(n));
      ['Llanowar Elves', 'Elvish Mystic', "Atraxa, Praetors' Voice", 'Sol Ring'].forEach(n => add(n));
      const c = add(k, {col:'G', imp:K('Lightning Bolt'), nc:{charge:/\d+\+ \|/.test(info(k)?.o || '') ? 25 : 2, storage:2, stash:2, soul:2, depletion:2, mining:2}, co:0, ctype:'Elf'});
      S.hand = ['Lightning Bolt', 'Llanowar Elves', 'Forest'].map(n => ({id:S.nid++, k:K(n)}));
      S.gy = ['Lightning Bolt', 'Lightning Bolt', 'Elvish Mystic', 'Forest', 'Forest', 'Swamp', 'Island'].map(n => ({id:S.nid++, k:K(n)}));
      S.lib = Array.from({length:20}, () => ({id:S.nid++, k:K('Forest')}));
      S.pool = {...emptyPool(), W:2, U:2, B:2, R:2, G:2, C:2}; S.pc = {energy:5};
      const o = (info(k)?.o || '') + ((info(k)?.back || {}).o || ''); if (/remove [^:]*\+1\/\+1 counter/i.test(o)) c.cp = 5; if (/remove [^:]*-1\/-1 counter/i.test(o)) c.cm = 2;
      return c;
    }
    // ---------- reference: what the text says, computed from the fixture independently of the engine ----------
    const tl = c => ((faceOf(c) || info(c.k))?.t || '');
    const isCr = c => /\bCreature\b/.test(tl(c));
    const pw = c => { const p = ((faceOf(c) || info(c.k))?.p || '').split('/'); return (parseInt(p[0]) || 0) + (c.cp || 0) - (c.cm || 0); };
    const tg = c => { const p = ((faceOf(c) || info(c.k))?.p || '').split('/'); return (parseInt(p[1]) || 0) + (c.cp || 0) - (c.cm || 0); };
    const LANDCOL = {Forest:'G', Island:'U', Swamp:'B', Mountain:'R', Plains:'W'};
    const landOuts = c => { const o = info(c.k)?.o || ''; const s = new Set(); for (const [t, x] of Object.entries(LANDCOL)) if (new RegExp('\\b' + t + '\\b').test(tl(c))) s.add(x); (o.match(/\{[WUBRGC]\}/g) || []).forEach(x => s.add(x[1])); if (/any color/i.test(o)) COL.forEach(x => s.add(x)); return s; };
    const sing = w => w.replace(/^elves$/, 'elf').replace(/ies$/, 'y').replace(/(ss)$/, '$1').replace(/([^s])s$/, '$1').replace(/^elves$/, 'elf');
    function typed(c, w){ w = w.toLowerCase().replace(/^elve$/, 'elf'); const t = tl(c).toLowerCase(); if (w === "urza's land") return /urza's/.test(t) && /land/.test(t); if (w === 'elf' || w === 'elves') return /\belf\b/.test(t); return new RegExp('\\b' + sing(w) + '\\b').test(t); }
    function refCount(ph, c, nm){
      let x = ph.toLowerCase().replace(/\.$/, '').trim(); const short = nm.split(',')[0].toLowerCase();
      [nm.toLowerCase(), short].forEach(n => { x = x.split(n).join('~'); });
      x = x.replace(/\bthis (creature|artifact|land|enchantment|permanent)\b/g, '~').replace(/^the number of /, '').replace(/^x is /, '');
      const mine = S.bf; let m;
      if ((m = x.match(/^(?:each )?(other )?creatures? you control$/))) return mine.filter(b => isCr(b) && !(m[1] && b === c)).length;
      if ((m = x.match(/^(?:each )?creatures? you control with defender$/))) return mine.filter(b => isCr(b) && /defender/i.test(info(b.k)?.o || '')).length;
      if ((m = x.match(/^(?:each )?basic (\w+) you control$/))) return mine.filter(b => /Basic/.test(tl(b)) && typed(b, m[1])).length;
      if ((m = x.match(/^(?:each )?(other )?([a-z']+(?: land)?)s? you control$/))) return mine.filter(b => typed(b, m[2]) && !(m[1] && b === c)).length;
      if ((m = x.match(/^(?:each )?(other )?([a-z']+?)s? on the battlefield$/))) return mine.filter(b => typed(b, m[2]) && !(m[1] && b === c)).length + 0;
      if ((m = x.match(/^(?:each )?(charge|storage|stash|soul) counters? on ~$/))) return (c.nc || {})[m[1]] || 0;
      if ((m = x.match(/^(?:each )?\+1\/\+1 counters? on ~$/))) return c.cp || 0;
      if ((m = x.match(/^~(?:'s)? power$/))) return pw(c);
      if ((m = x.match(/^the greatest power among creatures you control$/))) return Math.max(0, ...mine.filter(isCr).map(pw));
      if ((m = x.match(/^the greatest toughness among other creatures you control$/))) return Math.max(0, ...mine.filter(b => isCr(b) && b !== c).map(tg));
      if ((m = x.match(/^your devotion to (white|blue|black|red|green)$/))){ const L = {white:'W', blue:'U', black:'B', red:'R', green:'G'}[m[1]]; return mine.reduce((a, b) => a + ((info(b.k)?.m || '').match(/\{[^}]+\}/g) || []).filter(s => s.includes(L)).length, 0); }
      if ((m = x.match(/^(?:each )?(black |green |red |white |blue )?creature cards? in your graveyard$/))){ const L = m[1] ? {black:'B', green:'G', red:'R', white:'W', blue:'U'}[m[1].trim()] : null; return S.gy.filter(g => /Creature/.test(info(g.k)?.t || '') && (!L || (info(g.k)?.m || '').includes(L))).length; }
      if ((m = x.match(/^(?:each )?permanent cards? in your graveyard$/))) return S.gy.filter(g => !/Instant|Sorcery/.test(info(g.k)?.t || '')).length;
      if ((m = x.match(/^(?:each )?enchantments? you control$/))) return mine.filter(b => /Enchantment/.test(tl(b))).length;
      return null;
    }
    function refCond(t, c){ const l = t.toLowerCase(); let m;
      if (/luck counter/.test(l)) return ((c.nc || {}).luck || 0) > 0; if (/\+1\/\+1 counter on it/.test(l)) return (c.cp || 0) > 0;
      if ((m = l.match(/a creature with power (\d+) or greater/))) return S.bf.some(b => isCr(b) && pw(b) >= +m[1]);
      if ((m = l.match(/you control (\w+) or more creatures/))) return S.bf.filter(isCr).length >= NUM[m[1]];
      if (/a card is exiled with/.test(l)) return !!c.imp; if (/played a land this turn/.test(l)) return false; if (/initiative/.test(l)) return false; return false; }
    // returns {opts:[[...]]} exact alternatives, or {n, cols:[...], mono, distinct}, or {skip}
    function ref(eff, c, nm){
      const l = eff.replace(/\.$/, '').trim().toLowerCase(); let m;
      const syms = s => (s.match(/\{([wubrgc])\}/g) || []).map(x => x[1].toUpperCase());
      if (/the sacrificed creature's mana value$|the exiled creature's mana value$|the sacrificed land could produce$/.test(l)) return {late:l};
      if (/^add (?:x mana in any combination of colou?rs|\{c\} for each storage counter removed this way)$/.test(l)) return {removedN:true};
      if ((m = l.match(/^add ((?:\{[wubrgc]\})+(?:(?:,? or |, )(?:\{[wubrgc]\})+)*)$/))) return {opts:m[1].split(/,? or |, /).map(syms)};
      if ((m = l.match(/^add (one|two|three|four|five|six|seven|eight|nine|ten) mana of any (one )?colou?r$/))) return {n:NUM[m[1]], cols:COL, mono:!!m[2] || NUM[m[1]] === 1};
      if ((m = l.match(/^add (one|two|three) mana of any colou?r in your commander's colou?r identity$/))) return {n:NUM[m[1]], cols:['W', 'U', 'B', 'G'], mono:true};
      if ((m = l.match(/^add (one|two|three|four|five) mana in any combination of colou?rs$/))) return {n:NUM[m[1]], cols:COL};
      if ((m = l.match(/^add (one|two|three|four|five) mana in any combination of ((?:\{[wubrgc]\}(?:,? and\/or |, )?)+)$/))) return {n:NUM[m[1]], cols:syms(m[2])};
      if ((m = l.match(/^add (one|two|three|four|five) mana of different colou?rs$/))) return {n:NUM[m[1]], cols:COL, distinct:true};
      if ((m = l.match(/^add (one|two|three|four) mana of the chosen colou?r$/))) return {opts:[Array(NUM[m[1]]).fill('G')]};
      if ((m = l.match(/^add one mana of that colou?r for each (charge) counter on ~$/))) return {pickN:(c.nc || {}).charge || 0};
      if ((m = l.match(/^add (\{[wubrgc]\}) or one mana of the chosen colou?r$/))) return {opts:[syms(m[1]), ['G']]};
      if ((m = l.match(/^add one mana of any (?:type|colou?r) that a (basic )?land you control could produce$/))){ const s = new Set(); S.bf.forEach(b => { if (b !== c && /\bLand\b/.test(tl(b)) && (!m[1] || /Basic/.test(tl(b)))) landOuts(b).forEach(x => s.add(x)); }); if (/colou?r/.test(l)) s.delete('C'); return {n:1, cols:[...s], mono:true}; }
      if (/^add one mana of any colou?r that a land an opponent controls could produce$/.test(l)) return {n:1, cols:['R'], mono:true};
      if (/^add one mana of any colou?r that a gate you control could produce$/.test(l)) return {n:0, cols:[]};
      if (/^add one mana of any of the exiled card'?s'? colou?rs$/.test(l)) return {n:1, cols:['R'], mono:true};
      if ((m = l.match(/^add one mana of any colou?r among legendary (creatures and planeswalkers|permanents) you control$/))){ const s = new Set(); S.bf.forEach(b => { if (/Legendary/.test(tl(b)) && (m[1] === 'permanents' || /Creature|Planeswalker/.test(tl(b)))) (info(b.k)?.m || '').replace(/[^WUBRG]/g, '').split('').forEach(x => s.add(x)); }); return {n:s.size ? 1 : 0, cols:[...s], mono:true}; }
      if (/^add one mana of any colou?r among legendary creature cards in your graveyard$/.test(l)) return {n:0, cols:[]};
      if ((m = l.match(/^add (six|ten|seven) (\{[wubrgc]\})$/))) return {opts:[Array(NUM[m[1]]).fill(syms(m[2])[0])]};
      if ((m = l.match(/^add (\{[wubrgc]\}) for each (.+)$/))){ const n = refCount('each ' + m[2], c, nm); return n == null ? {skip:'count: ' + m[2]} : {opts:[Array(n).fill(syms(m[1])[0])]}; }
      if ((m = l.match(/^add an amount of (\{[wubrgc]\}) equal to (.+)$/))){ const n = refCount(m[2], c, nm); return n == null ? {skip:'count: ' + m[2]} : {opts:[Array(n).fill(syms(m[1])[0])]}; }
      if ((m = l.match(/^add x mana of any one colou?r, where x is (.+)$/))){ const n = refCount(m[1], c, nm); return n == null ? {skip:'count: ' + m[1]} : {n, cols:COL, mono:true}; }
      if ((m = l.match(/^add x mana in any combination of colou?rs, where x is (.+)$/))){ const n = refCount(m[1], c, nm); return n == null ? {skip:'count: ' + m[1]} : {n, cols:COL}; }
      if ((m = l.match(/^add x mana in any combination of ((?:\{[wubrgc]\}(?:,? and\/or |, )?)+), where x is (.+)$/))){ const n = refCount(m[2], c, nm); return n == null ? {skip:'count: ' + m[2]} : {n, cols:syms(m[1])}; }
      if ((m = l.match(/^add x (\{[wubrgc]\}) or x (\{[wubrgc]\}), where x is (.+)$/))){ const n = refCount(m[3], c, nm); return n == null ? {skip:'count'} : {opts:[Array(n).fill(syms(m[1])[0]), Array(n).fill(syms(m[2])[0])]}; }
      if (/^add an amount of mana of that colou?r equal to your devotion to that colou?r$/.test(l)){ const dv = {}; COL.forEach(L => { dv[L] = S.bf.reduce((a, b) => a + ((info(b.k)?.m || '').match(/\{[^}]+\}/g) || []).filter(s => s.includes(L)).length, 0); }); return {devo:dv}; }
      if (/^add an amount of mana of that colou?r equal to the number of creatures you control of the chosen type$/.test(l)){ const n = S.bf.filter(b => isCr(b) && /\bElf\b/.test(tl(b))).length; return {pickN:n}; }
      if (/the sacrificed creature's mana value$|the exiled creature's mana value$|the sacrificed land could produce$/.test(l)) return {late:l};
      return {skip:'pattern: ' + l};
    }
    const multiset = a => a.slice().sort().join('');
    const poolDiff = (a, b) => { const d = {}; for (const x of ['W', 'U', 'B', 'R', 'G', 'C']){ const v = (a[x] || 0) - (b[x] || 0); if (v) d[x] = v; } return d; };
    const dlist = d => Object.entries(d).flatMap(([x, v]) => v > 0 ? Array(v).fill(x) : []);
    const out = {abilities:0, ok:0, skip:0, bad:{}, rows:[], missing:0, fix:0, spells:0, spellsOk:0};
    const lineAbs = f => tname(f.o, f.n).split('\n').map(x => x.trim()).filter(x => /^[^:"]+:\s*(choose a colou?r\. )?add\b/i.test(x) && !/^[+−\-]?\d+:/.test(x) && !/^[^:]*\b(chapter|—)/i.test(x.split(':')[0]));
    const keys = only && only.length ? only.map(K).filter(Boolean) : [...new Set([...DICT.values()].filter(a => !a.tok).map(a => a.k))];
    for (const k of keys){
      const a = info(k); if (!a) continue;
      const faces = a.back ? [[a, false], [a.back, true]] : [[a, false]];
      for (const [f, fl] of faces){
        if (/\b(Instant|Sorcery)\b/.test(f.t || '')){
          // rituals and other mana spells: resolve the spell text
          const body = tname(f.o, f.n).split('\n').filter(x => /^(add|threshold)\b/i.test(x.trim())).join('\n'); if (!/(^|\n|\. )add \{/i.test(body) && !/(^|\n)add (one|two|three|x) mana/i.test(body)) continue;
          if (/\bfor each\b|\bequal to\b|\bX\b|instead|then add|chosen|that player|you may|choose|unless|spent/i.test(body) && !/^(Cabal Ritual|Rite of Flame)$/.test(f.n)) continue;
          out.spells++;
          board(K('Llanowar Elves')); S.bf.pop(); const before = {...S.pool}; REC = {log:[], toast:[], hand:[], modals:[]};
          try { await Promise.race([runEffects(body, {k, name:f.n, full:body, it:{kind:'spell', sid:'au', x:0}}), new Promise(r => setTimeout(r, 1500))]); } catch (e){ REC.hand.push('crash ' + e.message); }
          const got = multiset(dlist(poolDiff(S.pool, before)));
          let want = null; const first = body.split('\n')[0].split(/\.\s+/)[0].replace(/\.$/, '');
          if (f.n === 'Cabal Ritual') want = 'BBBBB'; else if (f.n === 'Rite of Flame') want = 'RR';
          let okN = false; if (want == null){ const r = ref(first, null, f.n); if (r.opts) want = multiset(r.opts[r.opts.length - 1]); else if (r.n){ want = r.n + ' of ' + r.cols.join(''); okN = got.length === r.n && got.split('').every(x => r.cols.includes(x)); } }
          const restr = /spend this mana only/i.test(body) ? (S.r21rm || []).length > 0 : true;
          const ok = want != null && (got === want || okN) && !REC.hand.length && restr;
          if (ok) out.spellsOk++; out.rows.push({n:f.n, line:first, kind:'spell', ok, got, want, hand:REC.hand});
          continue;
        }
        const lines = lineAbs(f); if (!lines.length) continue;
        let c = board(k); if (fl) c.fl = true;
        let abs; try { abs = manaAbs(c); } catch (e){ abs = []; }
        for (const line of lines){
          out.abilities++;
          const nm = f.n; const mm = line.match(/^([^:"]+):\s*((?:choose a colou?r\. )?add .+)$/i); const cost = mm[1].trim(); const effAll = mm[2].replace(/^choose a colou?r\. /i, ''); const eff = effAll.split(/\.\s+/)[0].replace(/\.$/, '');
          const rest = effAll.split(/\.\s+/).slice(1).join('. ');
          const ai = abs.findIndex(x => x.line && x.line.replace(/\s+/g, ' ').toLowerCase().startsWith(tname(line, nm).replace(/\s+/g, ' ').toLowerCase().slice(0, 30)));
          const row = {n:nm, line, kind:'ab'}; out.rows.push(row);
          const bad = why => { row.ok = false; row.why = why; out.bad[why.split(':')[0]] = (out.bad[why.split(':')[0]] || 0) + 1; };
          if (/from your hand/i.test(cost)){
            c = board(k); S.bf.splice(S.bf.indexOf(c), 1); S.hand.push(c); const before = {...S.pool}; REC = {log:[], toast:[], hand:[], modals:[]};
            try { await r21handMana(c, 0, 0); } catch (e){ REC.hand.push('crash ' + e.message); }
            const got = multiset(dlist(poolDiff(S.pool, before))); const r = ref(eff, c, nm); row.got = got;
            if (r.opts && r.opts.map(multiset).includes(got) && S.ex.includes(c) && !REC.hand.length){ row.ok = true; out.ok++; } else bad(`hand ability: got ${got || 'nothing'}`);
            continue;
          }
          if (ai < 0){ out.missing++; bad('not listed as a mana ability'); continue; }
          let r = ref(eff, c, nm);
          if (r.skip){ row.skip = r.skip; }
          const outsN = Math.max(1, (abs[ai].outs || []).length);
          const chs = r.opts ? Array.from({length:Math.min(outsN, 6)}, (_, i) => i) : [0];
          let fail = null;
          for (const ch of chs){
            c = board(k); if (fl) c.fl = true; const ab = manaAbs(c)[ai];
            if (/\{Q\}/.test(cost)) c.tap = true;
            r = ref(eff, c, nm); const inst = rest.match(/^if ([^,]+), (?:instead (add [^.]+)|(add [^.]+?) instead)/i); if (inst && refCond(inst[1], c)) r = ref(inst[2] || inst[3], c, nm);
            const before = {...S.pool}; const life0 = S.life; const hand0 = S.hand.length; const gy0 = S.gy.length; const ctr0 = (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((x, y) => x + y, 0);
            REC = {log:[], toast:[], hand:[], modals:[]};
            const cm = costMana(ab.cost.replace(/~/g, nm)); let pred = before;
            if (cm){ const pl = payPlan(cm, before); if (!pl.err) pred = pl.pool; }
            try { await Promise.race([activateMana(c, ab, ch), new Promise(r => setTimeout(r, 1500))]); } catch (e){ REC.hand.push('crash ' + e.message); }
            await new Promise(r => setTimeout(r, 0));
            const d = poolDiff(S.pool, pred); const got = dlist(d); const neg = Object.values(d).some(v => v < 0);
            const prompts = REC.modals.filter(x => x.type !== 'pick');
            const asks = REC.modals.filter(x => x.type === 'ask');
            row.got = multiset(got);
            // costs
            const lc = cost.toLowerCase(); const lifeWant = -(((lc.match(/pay (\d+) life/) || [])[1] | 0) + ((rest.match(/deals (\d+) damage to you/i) || [])[1] | 0) + ((rest.match(/you lose (\d+) life/i) || [])[1] | 0));
            if (REC.hand.length || REC.toast.some(t => /by hand/i.test(t))){ fail = 'manual: ' + (REC.hand[0] || REC.toast[0]); break; }
            if (REC.toast.length && !got.length && /you need|doesn't have|isn't tapped/i.test(REC.toast[0])){ row.skip = 'fixture: ' + REC.toast[0]; fail = null; break; }
            if (REC.toast.length && !got.length){ fail = 'refused: ' + REC.toast[0]; break; }
            if (asks.length){ fail = 'number prompt: ' + asks[0].title; break; }
            if (neg){ fail = 'pool lost mana: ' + JSON.stringify(d); break; }
            if (/\{t\}/i.test(lc) && !/sacrifice ~|sacrifice this|sacrifice (?:an? |the )?\w+ named/i.test(lc) && S.bf.includes(c) && !c.tap){ fail = 'cost: not tapped'; break; }
            if (/sacrifice (~|this)/i.test(lc) && S.bf.includes(c)){ fail = 'cost: not sacrificed'; break; }
            if (/sacrifice (?:an?|another) /i.test(lc) && S.gy.length <= gy0 && S.bf.includes(c)){ fail = 'cost: nothing sacrificed'; break; }
            if (/discard/i.test(lc) && S.hand.length >= hand0){ fail = 'cost: no discard'; break; }
            if (/remove/i.test(lc) && /counter/i.test(lc)){ const ctr1 = (c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((x, y) => x + y, 0); if (ctr1 >= ctr0){ fail = 'cost: counter not removed'; break; } }
            if (S.life - life0 !== lifeWant && !/life/i.test(rest.replace(/deals \d+ damage to you|you lose \d+ life/gi, ''))){ fail = `life: ${S.life - life0} want ${lifeWant}`; break; }
            if (r.skip){ if (!got.length && !/\bx\b|for each|equal|amount/i.test(eff)){ fail = 'no mana'; break; } continue; }
            if (r.late){ const gone = S.gy.slice(gy0).concat(S.ex).filter(x => x.k !== c.k).pop(); const mv = gone ? (info(gone.k)?.mv || 0) : -1;
              if (/land could produce/.test(r.late)){ if (!gone || !landOuts(gone).has(got[0]) || got.length !== 1){ fail = `sacrificed land: got ${multiset(got)}`; break; } continue; }
              const want = mv + (/exiled/.test(r.late) ? 1 : 0); if (got.length !== want || new Set(got).size > 1){ fail = `mana value: got ${multiset(got)} want ${want}`; break; } continue; }
            if (r.removedN){ const n = ctr0 - ((c.cp || 0) + (c.cm || 0) + Object.values(c.nc || {}).reduce((x, y) => x + y, 0)); if (got.length !== n || !n){ fail = `counters removed ${n}, got ${multiset(got)}`; break; } continue; }
            if (r.pickN != null){ if (new Set(got).size > 1 || got.length !== r.pickN){ fail = `chosen colour: got ${multiset(got)} want ${r.pickN}`; break; } continue; }
            if (r.devo){ const L = got[0]; if (!L || new Set(got).size > 1 || got.length !== r.devo[L]){ fail = `devotion: got ${multiset(got) || 'nothing'} want ${JSON.stringify(r.devo)}`; break; } continue; }
            if (r.opts){
              const wantOpts = r.opts.map(multiset);
              if (!wantOpts.includes(multiset(got))){ fail = `amount/colour: got ${multiset(got) || 'nothing'} want ${wantOpts.join('|')}`; break; }
              if (r.opts.length === 1 && prompts.length){ fail = 'prompt for a fixed output: ' + prompts[0].title; break; }
            } else {
              if (got.length !== r.n){ fail = `amount: got ${multiset(got) || 'nothing'} want ${r.n}`; break; }
              if (got.some(x => !r.cols.includes(x))){ fail = `colour: got ${multiset(got)} allowed ${r.cols.join('')}`; break; }
              if (r.mono && new Set(got).size > 1){ fail = `not one colour: ${multiset(got)}`; break; }
              if (r.distinct && new Set(got).size !== got.length){ fail = `not different colours: ${multiset(got)}`; break; }
              if (r.cols.length <= 1 && prompts.length){ fail = 'prompt with only one possible colour'; break; }
            }
          }
          if (fail) bad(fail); else if (row.skip){ if (/^fixture/.test(row.skip)) out.fix++; else out.skip++; row.ok = 'skip'; } else { row.ok = true; out.ok++; }
        }
      }
    }
    // ---------- mana from triggers and statics, and special lands ----------
    out.scen = [];
    const scen = async (name, fn) => { REC = {log:[], toast:[], hand:[], modals:[]}; let r; try { r = await fn(); } catch (e){ r = {ok:false, why:'crash ' + e.message}; } if (REC.hand.length) r = {ok:false, why:'manual: ' + REC.hand[0] + ' ' + (r.why || '')}; out.scen.push({name, ...r}); };
    const clean = () => { const c = board(K('Llanowar Elves')); S.bf = S.bf.filter(b => b !== c); S.pool = emptyPool(); return c; };
    const put = (n, o = {}) => { const c = {id:S.nid++, k:K(n), tap:false, sk:false, cp:0, cm:0, co:0, n:1, tn:0, ...o}; S.bf.push(c); return c; };
    const tapFor = async (c, i = 0, ch = 0) => { const before = {...S.pool}; await activateMana(c, manaAbs(c)[i], ch); await new Promise(r => setTimeout(r, 0)); return multiset(dlist(poolDiff(S.pool, before))); };
    const exp = (got, want, extra = '') => ({ok:got === want, why:`got ${got || 'nothing'} want ${want} ${extra}`.trim()});
    const forest = () => S.bf.find(b => cname(b) === 'Forest');
    await scen('Mana Reflection: Forest → GG', async () => { clean(); put('Mana Reflection'); return exp(await tapFor(forest()), 'GG'); });
    await scen('Nyxbloom Ancient: Sol Ring → 6 C', async () => { clean(); put('Nyxbloom Ancient'); return exp(await tapFor(S.bf.find(b => cname(b) === 'Sol Ring')), 'CCCCCC'); });
    await scen('Mana Reflection + Nyxbloom: Forest → 6 G', async () => { clean(); put('Nyxbloom Ancient'); put('Mana Reflection'); return exp(await tapFor(forest()), 'GGGGGG'); });
    await scen('Zendikar Resurgent: Forest → GG', async () => { clean(); put('Zendikar Resurgent'); return exp(await tapFor(forest()), 'GG'); });
    await scen('Zendikar Resurgent: Sol Ring → CC (not a land)', async () => { clean(); put('Zendikar Resurgent'); return exp(await tapFor(S.bf.find(b => cname(b) === 'Sol Ring')), 'CC'); });
    await scen('Caged Sun (green): Forest → GG, Mountain → R, Sol Ring → CC', async () => { clean(); put('Caged Sun', {col:'G'}); const a = await tapFor(forest()); const b = await tapFor(S.bf.find(x => cname(x) === 'Mountain')); const c = await tapFor(S.bf.find(x => cname(x) === 'Sol Ring')); return exp(a + '|' + b + '|' + c, 'GG|R|CC'); });
    await scen('Kinnan: Sol Ring → CCC, Forest → G', async () => { clean(); put('Kinnan, Bonder Prodigy'); const a = await tapFor(S.bf.find(x => cname(x) === 'Sol Ring')); const b = await tapFor(forest()); return exp(a + '|' + b, 'CCC|G'); });
    await scen('Badgermole Cub: Llanowar Elves → GG, Forest → G', async () => { clean(); put('Badgermole Cub'); const a = await tapFor(S.bf.find(x => cname(x) === 'Llanowar Elves')); const b = await tapFor(forest()); return exp(a + '|' + b, 'GG|G'); });
    await scen('Mana Echoes: an Elf enters with 2 other Elves → CCC', async () => { clean(); put('Mana Echoes'); const e = put('Llanowar Elves'); const before = {...S.pool};
      const t = trigsOf(K('Mana Echoes')).find(x => x.ev); const effTxt = (t && t.eff) || 'You may add an amount of {C} equal to the number of creatures you control that share a creature type with it.';
      await runEffects(effTxt, {k:K('Mana Echoes'), name:'Mana Echoes', srcId:S.bf.find(b => cname(b) === 'Mana Echoes').id, it:{kind:'trigger', evId:e.id, evk:e.k}, full:effTxt}); return exp(multiset(dlist(poolDiff(S.pool, before))), 'CCC', t ? 'trigger ' + t.ev : 'no trigger'); });
    await scen('Cabal Coffers + Urborg: all 8 lands are Swamps → pay {2}, add 8 B', async () => { clean(); put('Urborg, Tomb of Yawgmoth'); const cc = put('Cabal Coffers'); S.pool = {...emptyPool(), C:2}; const got = await tapFor(cc); return {ok:S.pool.B === 8 && S.pool.C === 0, why:`pool after ${JSON.stringify(S.pool)} (want B 8 = 6 basics/others + Urborg + Coffers, C 0)`}; });
    await scen('Gaea\'s Cradle: 3 creatures → GGG', async () => { clean(); const c = put("Gaea's Cradle"); return exp(await tapFor(c), 'GGG'); });
    await scen('Forsaken City: taps for any colour, stays tapped in untap, upkeep exile untaps it', async () => { clean(); const c = put('Forsaken City'); const a = await tapFor(c, 0, 1); untapAll(true); const stays = c.tap;
      const h0 = S.hand.length; const t = trigsOf(K('Forsaken City')).find(x => x.ev); await runEffects(t ? t.eff : 'You may exile a card from your hand. If you do, untap this land.', {k:c.k, name:'Forsaken City', srcId:c.id, it:{kind:'trigger'}});
      return {ok:a.length === 1 && stays && !c.tap && S.hand.length === h0 - 1 && !!t, why:`mana ${a}, stayed tapped ${stays}, untapped after upkeep ${!c.tap}, hand ${h0}→${S.hand.length}, trigger ${t ? t.ev : 'none'}`}; });
    await scen('Pillar of Origins (Elf): mana casts an Elf, not Worldly Tutor', async () => { clean(); const p = put('Pillar of Origins', {ctype:'Elf'}); const g = await tapFor(p, 0, 4); const elf = {id:S.nid++, k:K('Elvish Mystic')}; const lore = {id:S.nid++, k:K('Worldly Tutor')}; S.hand.push(elf, lore);
      const a = castCheck(elf, 'hand').ok, b = castCheck(lore, 'hand').ok; return {ok:g === 'G' && a && !b, why:`mana ${g}, Elf castable ${a}, Worldly Tutor castable ${b}`}; });
    await scen('Jegantha: WUBRG pays {G}{U} but not {1}{G}', async () => { clean(); const j = put('Jegantha, the Wellspring'); const g = await tapFor(j); const a = !payPlan(parseCost('{G}{U}'), S.pool).err, b = !payPlan(parseCost('{1}{G}'), S.pool).err; return {ok:g === 'BGRUW' && a && !b, why:`mana ${g}, {G}{U} ${a}, {1}{G} ${b}`}; });
    REC = null; Object.assign(window, saved); OPP.clear();
    return out;
  }, [names]);
  const det = names.length > 0;
  for (const r of R.rows) if (det || r.ok === false) if (det || process.env.V) console.log((r.ok === true ? 'OK   ' : r.ok === 'skip' ? 'SKIP ' : 'BAD  ') + r.n + ' | ' + r.line + (r.why ? '  → ' + r.why : '') + (r.skip ? '  (' + r.skip + ')' : '') + (r.kind === 'spell' ? ` got ${r.got} want ${r.want} ${r.hand.join(';')}` : ''));
  console.log(`\nmana abilities: ${R.abilities}  correct: ${R.ok}  unverified count/pattern (automatic, amount not checked): ${R.skip}  cost not payable on the test board: ${R.fix}  wrong: ${R.abilities - R.ok - R.skip - R.fix}  (not listed: ${R.missing})`);
  console.log(`mana spells (fixed output + Cabal Ritual, Rite of Flame): ${R.spells}  correct: ${R.spellsOk}`);
  console.log('wrong by kind:', JSON.stringify(R.bad));
  for (const x of R.scen || []) console.log((x.ok ? '  ✓ ' : '  ✗ ') + x.name + (x.ok ? '' : '  → ' + x.why));
  console.log(`triggers/statics/special lands: ${(R.scen || []).filter(x => x.ok).length}/${(R.scen || []).length}`);
  if (!det) fs.writeFileSync(process.env.OUTM || '/tmp/Cmana.json', JSON.stringify(R.rows.filter(r => r.ok !== true), null, 0));
  await b.close(); process.exit(0);
})();
