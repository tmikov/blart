/// <reference path="blpapi.d.ts" />
/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/bluebird/bluebird.d.ts" />
/// <reference path="typings/debug/debug.d.ts" />
var http = require("http");
var https = require("https");
var fs = require("fs");
var blpapi = require("blpapi");
var Promise = require("bluebird");
var connect = require("connect");
var parseurl = require("parseurl");
var qs = require("qs");
var debugMod = require("debug");
var debug = debugMod("blart:debug");
var info = debugMod("blart:info");
var error = debugMod("blart.error");
var loadConfig = require("./lib/config");
var StrMap = require("./lib/StrMap");
var symbols = [
    { n: 'VOLU Index' },
    { n: 'MVOLQE Index' },
    { n: 'TAV1S Index' },
    { n: 'TAV2S Index' },
    { n: 'FRANVOL Index' },
    { n: 'LSEVOL Index' },
    { n: 'HKSEVOL Index' },
    { n: 'SHCOVOL Index' },
    { n: 'SPTXVOLC Index' },
    { n: 'VO399106 Index' },
    { n: 'DAXVOLC Index' },
    { n: 'VOLSMI Index' },
    { n: 'BSEVOL Index' },
    { n: 'NSEVOL Index' },
    { n: 'ASXVOL Index' },
    { n: 'KOVOL Index' /*, m:1e3*/ },
    { n: 'VOLSM Index' },
    { n: 'TWVOLU Index' },
];
var symMap = new StrMap(); //< map from correlator id to Symbol
var curValues = {};
var lastRequestTime;
var corid = 0;
/**
 * Create a function do add a group of listeners which are all automatically
 * removed when any one of them fires.
 *
 * @param emitter  the even emitter where the listeners will be added.
 * @returns {function(string, Function): undefined}
 */
function listenGroup(emitter) {
    var listeners = [];
    return function (name, cb) {
        var ourcb = function (err, data) {
            for (var i in listeners) {
                var l = listeners[i];
                emitter.removeListener(l.name, l.cb);
            }
            listeners = [];
            cb(err, data);
        };
        emitter.addListener(name, ourcb);
        listeners.push({ name: name, cb: ourcb });
    };
}
function timeSeconds() {
    return process.hrtime()[0];
}
try {
    var config = loadConfig().get();
}
catch (ex) {
    console.log(ex.message);
    process.exit(1);
}
try {
    var blsess = new blpapi.Session({ serverHost: config.api.host, serverPort: config.api.port });
}
catch (ex) {
    console.log("Error creating API connection", ex.message);
    process.exit(2);
}
debug("Session created");
var listen = listenGroup(blsess);
function startSession() {
    return new Promise(function (fullfill, reject) {
        blsess.start();
        listen("SessionStarted", function () {
            debug("Session started");
            fullfill(void 0);
        });
        listen("SessionStartupFailure", function (err) {
            error("Session error", err);
            reject(err);
        });
    });
}
function openService(uri) {
    return new Promise(function (fullfill, reject) {
        blsess.openService(uri, ++corid);
        listen("ServiceOpened", function () {
            debug("Service %s opened", uri);
            fullfill(void 0);
        });
        listen("ServiceOpenFailure", function (err) {
            reject(err);
        });
    });
}
function subscribe(symbols) {
    var subs = [];
    symbols.forEach(function (sym) {
        ++corid;
        subs.push({
            security: "//blp/mktdata/" + sym.n,
            fields: ["LAST_PRICE"],
            options: { interval: config.interval },
            correlation: corid
        });
        symMap.set(corid, sym);
    });
    blsess.subscribe(subs);
    blsess.addListener("MarketDataEvents", function (d) {
        //        console.log(d.data.MKTDATA_EVENT_TYPE, d.data.MKTDATA_EVENT_SUBTYPE);
        if (d.eventType === "SUBSCRIPTION_DATA") {
            var sym = symMap.get(d.correlations[0].value);
            if (sym && d.data.LAST_PRICE !== undefined && d.data.LAST_PRICE !== null) {
                var volume = d.data.LAST_PRICE;
                if (sym.m)
                    volume *= sym.m;
                curValues[sym.n] = volume;
            }
            else {
            }
        }
    });
}
startSession().then(openService.bind(null, "//blp/mktdata")).then(subscribe.bind(null, symbols));
lastRequestTime = timeSeconds() - config.interval - 20;
var app = connect();
app.use(function (req, res, next) {
    // Authorize
    var q = qs.parse(parseurl(req).query);
    if (q.token !== config.token) {
        res.statusCode = 401;
        return res.end('Unauthorized');
    }
    // Rate-limit
    var tm = timeSeconds();
    if (tm - lastRequestTime < config.limit) {
        res.statusCode = 403;
        return res.end('Rate limited');
    }
    lastRequestTime = tm;
    // Send data
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(curValues));
});
var server;
if (config.https) {
    var serverOptions = {
        key: fs.readFileSync(config.key),
        cert: fs.readFileSync(config.cert),
        passphrase: config.pass
    };
    server = https.createServer(serverOptions, app);
}
else {
    server = http.createServer(app);
}
server.listen(config.port);
server.once('listening', function () {
    console.log("Listening on", config.port);
});
//# sourceMappingURL=index.js.map