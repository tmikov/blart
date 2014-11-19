TSC=tsc
TSFLAGS=--module commonjs --target ES5 --sourceMap

%.js : %.ts
	$(TSC) $(TSFLAGS) $<

all: index.js

dist: all
	@./mkdist.sh

clean:
	@rm -f -v *.js *.js.map
	@rm -f -v tslib/*.js tslib/*.js.map

