import pathlib
src = pathlib.Path('src')
head = (src/'head.html').read_text().replace('/*ENGINE_CSS*/', (src/'engine.css').read_text())
parts = ['main.js','engine.js','engine2.js','combat.js','engine4.js','engine5.js','engine6.js','engine7.js','engine8.js', 'engine9.js', 'engine10.js', 'engine11.js', 'engine12.js', 'engine13.js', 'engine14.js', 'engine15.js', 'engine16.js', 'engine17.js', 'engine18.js', 'engine19a.js', 'engine19b.js', 'engine19c.js', 'engine20.js','engine21a.js','engine21b.js','engine21c.js','engine21d.js','engine21e.js','engine22.js','autopay.js','engine23f.js','engine23g.js','engine23h.js','engine23i.js','engine23j.js','engine23k.js','engine24l.js','engine24m.js','engine24n.js','engine24o.js','engine24p.js','engine24q.js','engine25r.js','engine25s.js','engine25t.js','engine25u.js','engine25v.js','engine25w.js','engine26a.js','engine26b.js','engine26c.js','engine26y.js','engine26z.js','engine26s2.js','engine26x.js','engine27a.js','engine27b.js','engine27c.js','engine27d.js','engine27e.js','engine27f.js','fix18.js','fix18b.js','fix18c.js','fix18d.js','fix19a.js','fix19b.js','fix19c.js','fix19d.js','fix20a.js','fix20b.js','fix20c.js','fix21a.js','fix22a.js','fix23a.js','fix23b.js','fix24a.js','combos25.js','fix25a.js','fix26a.js','fix27a.js','fix27b.js','fix27c.js','fix27z.js','fix30a.js','bots.js','cardroles.js','botlevels.js','botlevels2.js','trainer.js','master.js','coach.js','deckedit.js','pages.js','ui28.js','deck29.js','topdecks.js','init.js']
import os
extra=[x for x in os.environ.get('EXTRA','').split(',') if x]
parts = parts[:-1] + extra + parts[-1:]
out = head + ''.join((src/p).read_text() for p in parts if (src/p).exists())
import os
pathlib.Path(os.environ.get('OUT','proxy-table.html')).write_text(out)
print(len(out))
