#!/bin/bash
# What the GitHub machine runs (edit + push to start a run). Output goes in ./out
set -x
OUT=/tmp/game.html python3 build.py
cp /tmp/game.html test/game.html
cd test
REAL=1 PTFILE=test/game.html PTPORT=9700 SHOTDIR=../out/workshop timeout 900 node playtest.js
ONLINE=1 REAL=1 LEVELS=hard,veryhard,master TURNSP=40 PTFILE=test/game.html PTPORT=9710 SHOTDIR=../out/pod ONLY=pod timeout 2400 node rbots.js
