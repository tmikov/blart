/// <reference path="typings/tsd.d.ts" />

import http = require("http");
import https = require("https");
import fs = require("fs");

import blpapi = require("blpapi");
import Promise = require("bluebird");
var connect = require("connect");
var parseurl = require("parseurl");
var qs = require("qs");

import debugMod = require("debug");

var debug = debugMod("blart:debug");
var info = debugMod("blart:info");
var error = debugMod("blart.error");

var loadConfig = require("./lib/config");
import StrMap = require("./tslib/StrMap");

interface Symbol
{
    n: string;
    m?: number;
}

var symbols: Symbol[] = [
    { n: 'VOLU Index' },
    { n: 'MVOLQE Index' },
    { n: 'TAV1S Index'},
    { n: 'TAV2S Index'},
    { n: 'FRANVOL Index'},
    { n: 'LSEVOL Index'},
    { n: 'HKSEVOL Index'},
    { n: 'SHCOVOL Index'},
    { n: 'SPTXVOLC Index'},
    { n: 'VO399106 Index'},
    { n: 'DAXVOLC Index'},
    { n: 'VOLSMI Index'},
    { n: 'BSEVOL Index'},
    { n: 'NSEVOL Index'},
    { n: 'ASXVOL Index'},
    { n: 'KOVOL Index', m:1e-3},
    { n: 'VOLSM Index'},
    { n: 'TWVOLU Index'},

//    { n: 'IBM US Equity', m:1e3 },
//    { n: 'cusip/912810RE0@BGN' },
];

var symMap = new StrMap<Symbol>(); //< map from correlator id to Symbol
var curValues = {};
var lastRequestTime: number;
var requestCount: number = 0;
var corid = 0;
var startTime: number;


/**
 * Create a function do add a group of listeners which are all automatically
 * removed when any one of them fires.
 *
 * @param emitter  the even emitter where the listeners will be added.
 * @returns {function(string, Function): undefined}
 */
function listenGroup ( emitter: any ): (name: string, cb: Function)=>void
{
    var listeners: {name: string; cb: Function}[] = [];

    return (name: string, cb: Function) => {
        var ourcb = (err, data) => {
            for ( var i in listeners ){
                var l = listeners[i];
                emitter.removeListener( l.name, l.cb );
            }
            listeners = [];
            cb( err, data );
        };
        emitter.addListener( name, ourcb );
        listeners.push( {name: name, cb: ourcb });
    }
}

function timeSeconds (): number
{
    return process.hrtime()[0];
}

function uptime (): {days: number; hours: number; minutes: number}
{
    var t = timeSeconds() - startTime;
    var res = {days:0, hours:0, minutes:0};
    t /= 60;
    res.minutes = (t % 60) | 0;
    t /= 60;
    res.hours = (t % 24) | 0;
    res.days = (t / 24) | 0;
    return res;
}

try {
    var config = loadConfig().get();
} catch(ex) {
    console.log( ex.message );
    process.exit( 1 );
}

try {
    var blsess = new blpapi.Session({serverHost: config.api.host, serverPort: config.api.port });
} catch(ex) {
    console.log( "Error creating API connection", ex.message );
    process.exit( 2 );
}
debug("Session created");

var listen = listenGroup( blsess );

function startSession (): Promise<any>
{
    return new Promise((fullfill, reject) => {
        blsess.start();
        listen("SessionStarted", () => {
            debug("Session started");
            fullfill(void 0);
        });
        listen("SessionStartupFailure", (err) => {
            error("Session error", err);
            reject(err);
        });
    });
}

function openService ( uri: string ): Promise<any>
{
    return new Promise( (fullfill, reject) => {
        blsess.openService(uri, ++corid);
        listen( "ServiceOpened", () => {
            debug( "Service %s opened", uri );
            fullfill(void 0);
        });
        listen( "ServiceOpenFailure", (err) => {
            reject(err);
        })
    });
}

function subscribe ( symbols: Symbol[] ): void
{
    var subs: blpapi.Subscription[] = [];
    symbols.forEach( (sym: Symbol) => {
        ++corid;
        subs.push( {
            security: "//blp/mktdata/" + sym.n,
            fields: ["LAST_PRICE"],
            options: { interval: config.interval },
            correlation: corid
        });
        symMap.set( corid, sym );
    });
    blsess.subscribe( subs );
    blsess.addListener("MarketDataEvents", (d) => {
//        console.log(d.data.MKTDATA_EVENT_TYPE, d.data.MKTDATA_EVENT_SUBTYPE);
        if (d.eventType === "SUBSCRIPTION_DATA") {
            var sym: Symbol = symMap.get( d.correlations[0].value );
            if (sym && d.data.LAST_PRICE !== undefined && d.data.LAST_PRICE !== null) {
                var volume = d.data.LAST_PRICE;
                if (sym.m)
                    volume *= sym.m;
                curValues[sym.n] = volume;
//                console.log(curValues);
            }
            else {
//                console.log(d);
            }
        }
    });
}

startSession()
    .then( openService.bind(null, "//blp/mktdata") )
    .then( subscribe.bind(null, symbols) );


lastRequestTime = timeSeconds() - config.interval - 20;
startTime = timeSeconds();

var app = connect();

app.use( "/monitor", (req: http.ServerRequest, res: http.ServerResponse, next: Function) => {
    res.setHeader("content-type", "text/plain");
    var t = uptime();
    res.end( "uptime: "+t.days+"d "+t.hours+"h "+t.minutes+"m\n"+
             "requests: "+requestCount+"\n" );
});

app.use( "/", (req: http.ServerRequest, res: http.ServerResponse, next: Function) => {
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
    res.end( JSON.stringify(curValues) );
});

var server;

if (config.https) {
   var serverOptions:https.ServerOptions = {
       key: fs.readFileSync(config.key),
       cert: fs.readFileSync(config.cert),
       passphrase: config.pass
   };
   server = https.createServer( serverOptions, app );
} else {
   server = http.createServer( app );
}

server.listen( config.port );
server.once('listening', () => {
    console.log( "Listening on", config.port );
});
