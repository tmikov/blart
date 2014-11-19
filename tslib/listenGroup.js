/// <reference path="../typings/tsd.d.ts" />
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
module.exports = listenGroup;
//# sourceMappingURL=listenGroup.js.map