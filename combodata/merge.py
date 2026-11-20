#!/usr/bin/env python3
"""Merge raw EDHREC combo page dumps into one ranked JSON file.

Reads raw/<slug>.txt (lines: "Card A + Card B | Result; Result | 12345"),
dedupes by sorted card tuple (keeping the highest deck count), sorts by deck
count descending, keeps the top 1000, writes combos_top1000.json.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "combos_top1000.json")
TOP_N = 1000

MORE_RE = re.compile(r"^\+\s*\d+\s+more\s+results?$", re.I)
PREREQ_RE = re.compile(r"^\+\s*\d+\s+(other\s+)?prereq(uisite)?s?$", re.I)


def parse_line(line):
    parts = [p.strip() for p in line.split(" | ")]
    if len(parts) < 3:
        return None
    cards_s, results_s, count_s = parts[0], " | ".join(parts[1:-1]), parts[-1]
    count_s = count_s.replace(",", "").strip()
    if not count_s.isdigit():
        return None
    cards = [c.strip() for c in cards_s.split(" + ") if c.strip()]
    if len(cards) < 1:
        return None
    results, prereq = [], False
    for r in results_s.split("; "):
        r = r.strip()
        if not r:
            continue
        if MORE_RE.match(r):
            continue
        if PREREQ_RE.match(r):
            prereq = True
            continue
        results.append(r)
    return {"cards": cards, "results": results, "decks": int(count_s), "prereq": prereq}


def main():
    best = {}
    stats = {}
    for fn in sorted(os.listdir(RAW)):
        if not fn.endswith(".txt"):
            continue
        slug = fn[:-4]
        n_ok = n_bad = 0
        with open(os.path.join(RAW, fn), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = parse_line(line)
                if rec is None:
                    n_bad += 1
                    continue
                n_ok += 1
                rec["colors"] = slug
                key = tuple(sorted(c.lower() for c in rec["cards"]))
                cur = best.get(key)
                if cur is None or rec["decks"] > cur["decks"]:
                    if cur is not None:
                        rec["prereq"] = rec["prereq"] or cur["prereq"]
                    best[key] = rec
                elif rec["prereq"]:
                    cur["prereq"] = True
        stats[slug] = (n_ok, n_bad)

    ranked = sorted(best.values(), key=lambda r: (-r["decks"], " + ".join(r["cards"])))
    top = ranked[:TOP_N]
    out = [
        {"rank": i + 1, "cards": r["cards"], "results": r["results"],
         "decks": r["decks"], "prereq": r["prereq"], "colors": r["colors"]}
        for i, r in enumerate(top)
    ]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    for slug, (ok, bad) in stats.items():
        print(f"{slug:12s} parsed={ok:4d} skipped={bad}")
    print(f"files={len(stats)} unique_combos={len(best)} written={len(out)}")
    if out:
        print(f"#1 decks={out[0]['decks']}  #{len(out)} decks={out[-1]['decks']}")
        for r in out[:15]:
            print(f"{r['rank']:3d}. {' + '.join(r['cards'])}  ({r['decks']}, {r['colors']})")


if __name__ == "__main__":
    sys.exit(main())
