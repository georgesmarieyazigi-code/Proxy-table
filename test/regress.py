# python3 regress.py /tmp/Xper.json → lists cards that were fully understood in v10 but are not now (regressions), and the gain
import json,sys
base=set(x[0] for x in json.load(open('/tmp/base_per.json'))); now=set(x[0] for x in json.load(open(sys.argv[1])))
reg=sorted(now-base); fixed=sorted(base-now)
print('newly understood:', len(fixed)); print('REGRESSIONS:', len(reg)); [print('  ', r) for r in reg[:50]]
