/// <reference path="../typings/tsd.d.ts" />

import events = require("events");

/**
 * Create a function do add a group of listeners which are all automatically
 * removed when any one of them fires.
 *
 * @param emitter  the even emitter where the listeners will be added.
 * @returns {function(string, Function): undefined}
 */
function listenGroup ( emitter: events.EventEmitter ): (name: string, cb: Function)=>void
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


export = listenGroup;
