TSC=tsc
TSFLAGS=--module commonjs --target ES5 --sourceMap

%.js : %.ts
	$(TSC) $(TSFLAGS) $<

all: index.js

