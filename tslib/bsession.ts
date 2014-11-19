 /// <reference path="../typings/tsd.d.ts" />

import events = require("events");

import blpapi = require("blpapi");
import Promise = require("bluebird");

import debugMod = require("debug");

import StrMap = require("./StrMap");
import listenGroup = require("./listenGroup");

var debug = debugMod("blart:debug");
var info = debugMod("blart:info");
var error = debugMod("blart.error");

enum BState { NEW, STARTED, SERVICE };

export interface Symbol
{
    n: string;
}

export class BSession<SYM extends Symbol> extends events.EventEmitter
{
    private blsess: blpapi.Session;
    private stopRequested: boolean = false;
    private corid = 0;
    private listen: (name: string, cb: Function)=>void;
    private symMap = new StrMap<SYM>(); //< map from correlator id to Symbol

    constructor ( private cfg: {host: string; port: number} )
    {
        super();
    }


    private startSession (): Promise<any>
    {
        try {
            this.blsess = new blpapi.Session( {serverHost: this.cfg.host, serverPort: this.cfg.port });
        } catch(ex) {
            console.log( "Error creating API connection", ex.message );
            process.exit( 2 );
        }
        debug("Session object created");

        this.listen = listenGroup( this.blsess );

        return new Promise((fullfill, reject) => {
            this.blsess.start();

            this.listen("SessionStarted", () => {
                debug("Session started");
                fullfill(void 0);
            });

            this.listen("SessionStartupFailure", (err) => {
                error("Session error", err);
                this.stopAsync();
                this.onSessionTerminated();
                reject(err);
            });

            this.blsess.addListener( "SessionTerminated", this.onSessionTerminated.bind(this) );
        });
    }

    private openService ( uri: string ): Promise<any>
    {
        return new Promise( (fullfill, reject) => {
            this.blsess.openService(uri, ++this.corid);

            this.listen( "ServiceOpened", () => {
                debug( "Service %s opened", uri );
                fullfill(void 0);
            });

            this.listen( "ServiceOpenFailure", (err) => {
                this.stopAsync();
                reject(err);
            })
        });
    }

    private stopAsync (): void
    {
        if (!this.stopRequested) {
            this.blsess.stop();
            this.stopRequested = true;
        }
    }

    private onSessionTerminated (): void
    {
        info( "onSessionTerminated" );
        if (!this.blsess) { // just in case
            error( "Double onSessionTerminated" );
            return;
        }
        this.stopAsync();
        this.blsess.destroy();
        this.blsess = null;
        this.listen = null;
        this.emit( "SessionTerminated" );
    }

    public connect (): Promise<any>
    {
        return this.startSession()
                    .then( ()=>{ return this.openService( "//blp/mktdata" ); } );
    }

    public subscribe ( symbols: SYM[], interval: number, cb: (sym: SYM, d:any)=>void ): void
    {
        var subs: blpapi.Subscription[] = [];
        symbols.forEach( (sym: SYM) => {
            ++this.corid;
            subs.push( {
                security: "//blp/mktdata/" + sym.n,
                fields: ["LAST_PRICE"],
                options: { interval: interval },
                correlation: this.corid
            });
            this.symMap.set( this.corid, sym );
        });
        this.blsess.subscribe( subs );

        this.blsess.addListener("MarketDataEvents", (d) => {
            debug(d.data.MKTDATA_EVENT_TYPE, d.data.MKTDATA_EVENT_SUBTYPE);
            if (d.eventType === "SUBSCRIPTION_DATA") {
                var sym: SYM = this.symMap.get( d.correlations[0].value );
                if (sym)
                    cb( sym, d );
            }
        });
    }
}
