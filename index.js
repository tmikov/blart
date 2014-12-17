/// <reference path="typings/tsd.d.ts" />
var http = require("http");
var https = require("https");
var fs = require("fs");
var connect = require("connect");
var parseurl = require("parseurl");
var qs = require("qs");
var cjson = require("cjson");
var tv4 = require("tv4");
var debugMod = require("debug");
var debug = debugMod("blart:debug");
var info = debugMod("blart:info");
var error = debugMod("blart.error");
var loadConfig = require("./lib/config");
var bsession = require("./tslib/bsession");
var schema = {
    "type": "array",
    "items": {
        "id": "Symbol",
        "type": "object",
        "properties": {
            "n": {
                "type": "string"
            },
            "m": {
                "type": "number"
            }
        },
        "required": [
            "n"
        ],
        "additionalProperties": false
    }
};
var symbols;
var curValues = {};
var lastRequestTime;
var requestCount = 0;
var startTime;
var bs = null;
var config;
function timeSeconds() {
    return process.hrtime()[0];
}
function uptime() {
    var t = timeSeconds() - startTime;
    var res = { days: 0, hours: 0, minutes: 0 };
    t /= 60;
    res.minutes = (t % 60) | 0;
    t /= 60;
    res.hours = (t % 24) | 0;
    res.days = (t / 24) | 0;
    return res;
}
function connectAPI() {
    bs = new bsession.BSession(config.api);
    bs.connect().then(function () {
        info("Successfully connected");
        bs.subscribe(symbols, config.interval, onSubscriptionUpdate);
    }).error(function (err) {
        error(err);
    });
    bs.addListener("SessionTerminated", function () {
        setTimeout(function () {
            info("Attempting to reconnect");
            connectAPI();
        }, 5000);
    });
}
function onSubscriptionUpdate(sym, d) {
    if (d.data.LAST_PRICE !== undefined && d.data.LAST_PRICE !== null) {
        var volume = d.data.LAST_PRICE;
        if (sym.m)
            volume *= sym.m;
        curValues[sym.n] = volume;
    }
    else {
    }
}
function loadSymbols(secpath) {
    try {
        var obj = cjson.load(secpath);
        var res = tv4.validateResult(obj, schema);
    }
    catch (ex) {
        throw new Error(secpath + ': ' + ex.message);
    }
    if (!res.valid)
        throw new Error(secpath + ': ' + res.error.message || "Invalid security file");
    return obj;
}
function main() {
    try {
        config = loadConfig().get();
        symbols = loadSymbols(config.secpath);
        info(symbols);
    }
    catch (ex) {
        console.error(ex.message);
        process.exit(1);
    }
    lastRequestTime = timeSeconds() - config.interval - 20;
    startTime = timeSeconds();
    var app = connect();
    app.use("/monitor", function (req, res, next) {
        res.setHeader("content-type", "text/plain");
        var t = uptime();
        res.end("uptime: " + t.days + "d " + t.hours + "h " + t.minutes + "m\n" + "requests: " + requestCount + "\n");
    });
    app.use("/", function (req, res, next) {
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
        ++requestCount;
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
    connectAPI();
    server.listen(config.port);
    server.once('listening', function () {
        console.log("Listening on", config.port);
    });
}
main();
//# sourceMappingURL=index.js.map