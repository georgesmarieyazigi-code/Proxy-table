import json, re
L = json.load(open('/home/claude/pt/combodata/combos_top1000.json'))
def clean(s): return re.sub(r'\s+', ' ', s).strip()
rows = []
for c in L:
    cards = [clean(x) for x in c['cards'] if clean(x)]
    res = [clean(x) for x in c.get('results', []) if clean(x) and not re.match(r'^\+\d', clean(x))]
    rows.append(['|'.join(cards), '; '.join(res), int(c.get('decks') or 0)])
out = '// The most-played Commander combos (EDHREC combo pages, Nov 2026): [cards, results, decks], ranked by decks.\nconst COMBOS25 = ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('/home/claude/pt/src/combos25.js', 'w').write(out)
print(len(rows), len(out))
