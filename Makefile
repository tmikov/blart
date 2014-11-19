TSC=tsc
TSFLAGS=--module commonjs --target ES5 --sourceMap

%.js : %.ts
	$(TSC) $(TSFLAGS) $<

.PHONY: all dist clean

all:
	$(TSC) $(TSFLAGS) index.ts

dist: all
	@./mkdist.sh

clean:
	@rm -f -v *.js *.js.map
	@rm -f -v tslib/*.js tslib/*.js.map

