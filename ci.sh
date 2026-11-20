#!/bin/bash
# What the GitHub machine runs (edit + push to start a run). Output goes in ./out
set -x
OUT=out/game.html python3 build.py
cd test
REAL=1 PTFILE=out/game.html PTPORT=9700 SHOTDIR=../out/workshop timeout 900 node playtest.js
REAL=1 PTFILE=out/game.html PTPORT=9710 SHOTDIR=../out/pod ONLY=pod timeout 1800 node rbots.js
