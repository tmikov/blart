#!/bin/sh

exec DEBUG="*:error,*:info" node index.js --cfg=/etc/blart/cfg.json

