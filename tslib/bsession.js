/// <reference path="../typings/tsd.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var events = require("events");
var blpapi = require("blpapi");
var Promise = require("bluebird");
var debugMod = require("debug");
var StrMap = require("./StrMap");
var listenGroup = require("./listenGroup");
var debug = debugMod("blart:debug");
var info = debugMod("blart:info");
var error = debugMod("blart.error");
var BState;
(function (BState) {
    BState[BState["NEW"] = 0] = "NEW";
    BState[BState["STARTED"] = 1] = "STARTED";
    BState[BState["SERVICE"] = 2] = "SERVICE";
})(BState || (BState = {}));
;
var BSession = (function (_super) {
    __extends(BSession, _super);
    function BSession(cfg) {
        _super.call(this);
        this.cfg = cfg;
        this.state = 0 /* NEW */;
        this.corid = 0;
        this.symMap = new StrMap(); //< map from correlator id to Symbol
    }
    BSession.prototype.startSession = function () {
        var _this = this;
        try {
            this.blsess = new blpapi.Session({ serverHost: this.cfg.host, serverPort: this.cfg.port });
        }
        catch (ex) {
            console.log("Error creating API connection", ex.message);
            process.exit(2);
        }
        debug("Session object created");
        this.listen = listenGroup(this.blsess);
        return new Promise(function (fullfill, reject) {
            _this.blsess.start();
            _this.listen("SessionStarted", function () {
                debug("Session started");
                _this.state = 1 /* STARTED */;
                fullfill(void 0);
            });
            _this.listen("SessionStartupFailure", function (err) {
                error("Session error", err);
                _this.blsess.stop();
                _this.onSessionTerminated();
                reject(err);
            });
            _this.blsess.addListener("SessionTerminated", _this.onSessionTerminated.bind(_this));
        });
    };
    BSession.prototype.openService = function (uri) {
        var _this = this;
        return new Promise(function (fullfill, reject) {
            _this.blsess.openService(uri, ++_this.corid);
            _this.listen("ServiceOpened", function () {
                debug("Service %s opened", uri);
                _this.state = 2 /* SERVICE */;
                fullfill(void 0);
            });
            _this.listen("ServiceOpenFailure", function (err) {
                _this.blsess.stop();
                reject(err);
            });
        });
    };
    BSession.prototype.onSessionTerminated = function () {
        info("onSessionTerminated");
        if (!this.blsess) {
            error("Double onSessionTerminated");
            return;
        }
        try {
            this.blsess.stop();
        }
        catch (err) {
            info("bogus error", err.message);
        }
        try {
            this.blsess.destroy();
        }
        catch (err) {
            info("bogus error", err.message);
        }
        this.blsess = null;
        this.listen = null;
        this.emit("SessionTerminated");
    };
    BSession.prototype.connect = function () {
        var _this = this;
        return this.startSession().then(function () {
            return _this.openService("//blp/mktdata");
        });
    };
    BSession.prototype.subscribe = function (symbols, interval, cb) {
        var _this = this;
        var subs = [];
        symbols.forEach(function (sym) {
            ++_this.corid;
            subs.push({
                security: "//blp/mktdata/" + sym.n,
                fields: ["LAST_PRICE"],
                options: { interval: interval },
                correlation: _this.corid
            });
            _this.symMap.set(_this.corid, sym);
        });
        this.blsess.subscribe(subs);
        this.blsess.addListener("MarketDataEvents", function (d) {
            debug(d.data.MKTDATA_EVENT_TYPE, d.data.MKTDATA_EVENT_SUBTYPE);
            if (d.eventType === "SUBSCRIPTION_DATA") {
                var sym = _this.symMap.get(d.correlations[0].value);
                if (sym)
                    cb(sym, d);
            }
        });
    };
    return BSession;
})(events.EventEmitter);
exports.BSession = BSession;
//# sourceMappingURL=bsession.js.map