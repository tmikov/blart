#!/bin/bash

rm -rf dist
mkdir dist
mkdir dist/lib
mkdir dist/tslib
cp -v package.json LICENSE scripts/blart.sh dist/
cp -v *.js dist/
cp -v lib/*.js dist/lib/
cp -v tslib/*.js dist/tslib/
cp -r examples dist/
cp -r scripts/upstart dist/
