var fs = require('fs');
var path = require('path');

var convict = require('convict');
var optimist = require('optimist');

module.exports = function () {
    var config = convict({
        'api': {
            'host': {
                doc: 'The Bloomberg Open API server address',
                format: 'ipaddress',
                default: '127.0.0.1',
                env: 'BLPAPI_HOST',
                arg: 'api-host'
            },
            'port': {
                doc: 'The Bloomberg Open API server port',
                format: 'port',
                default: 8194,
                env: 'BLPAPI_PORT',
                arg: 'api-port'
            }
        },
        'https': {
            doc: 'Enable/disable https',
            format: Boolean,
            default: true
        },
        'key': {
            format: String,
            default: null
        },
        'cert': {
            format: String,
            default: null
        },
        'pass': {
            format: String,
            default: 'pass'
        },
        'port': {
            doc: 'The http port to listen on',
            format: 'port',
            default: 80,
            env: 'HTTP_PORT',
            arg: 'port'
        },
        'interval': {
            doc: 'The update interval',
            format: 'int',
            default: 15
        },
        'limit': {
            doc: 'minimal time between request',
            format: 'int',
            default: 5
        },
        'token': {
            format: String,
            default: null
        }
    });

    if (optimist.argv.cfg)
        config.loadFile(optimist.argv.cfg);
    config.validate();
    return config;
};
