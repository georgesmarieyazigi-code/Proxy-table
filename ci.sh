#!/bin/bash
mkdir -p out
LIMIT=${LIMIT:-6} PER=2 node tools/topdecks.mjs
